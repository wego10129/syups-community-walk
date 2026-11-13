/*
 * 社區踏查地圖：畫面與互動程式（第 2 版）
 * 內容（路線、站點、題目）在 data/tour.js；注音在 js/zhuyin.js。
 */
(function () {
  "use strict";
  var TOUR = window.TOUR;
  var ST = TOUR.stations;
  var KEY = "community-walk-v2";

  /* ---------- 進度（只存在這台裝置的瀏覽器裡） ---------- */
  var state = { done: {}, at: 0, big: false, teacher: false, zhuyin: true };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) state = Object.assign(state, saved);
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- 小工具 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function uniq(arr) { return arr.filter(function (v, k) { return arr.indexOf(v) === k; }); }
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function zhNum(n) {
    if (n <= 10) return ZH[n];
    if (n < 20) return "十" + ZH[n - 10];
    return ZH[Math.floor(n / 10)] + "十" + (n % 10 ? ZH[n % 10] : "");
  }
  function zhDate() {
    var d = new Date();
    return zhNum(d.getMonth() + 1) + "月" + zhNum(d.getDate()) + "日";
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      var clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu, "");
      var u = new SpeechSynthesisUtterance(clean);
      u.lang = "zh-TW";
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- 角色與圖示 ---------- */
  var ART = window.ART;
  function art(key) {
    var m = {
      pig: function () { return ART.pig(false); }, pigFull: function () { return ART.pig(true); },
      mailboxRed: function () { return ART.mailbox("red"); }, mailboxGreen: function () { return ART.mailbox("green"); }, mailboxBlue: function () { return ART.mailbox("blue"); },
      thief: function () { return ART.thief(false); }, thiefCaught: function () { return ART.thief(true); },
      kidCheer: function () { return ART.kid("cheer"); }
    };
    if (m[key]) return m[key]();
    if (ART[key]) return ART[key]();
    return "";
  }
  function stars(n) { var h = ""; for (var k = 0; k < 3; k++) h += '<span class="st">' + ART.star(k < n) + "</span>"; return h; }
  // 答對、提示、完成的訊息框（圖示＋注音文字）
  function msg(cls, icon, text) { return el("div", "why " + cls, '<span class="mi">' + icon + "</span><span>" + zy(text) + "</span>"); }
  function okMsg(text) { return msg("", ART.check(), text); }
  function hintMsg(text) { return msg("hint", ART.think(), text); }
  function doneMsg(text, n) {
    return el("div", "why done", '<div class="cheer">' + ART.kid("cheer") + "</div>" + (n ? '<div class="stars">' + stars(n) + "</div>" : "") + "<div>" + zy(text) + "</div>");
  }
  // 站的小圖示做成圖片，畫到 3D 站牌上
  function svgImg(svgText) {
    var img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText.replace("<svg ", '<svg width="128" height="128" '));
    return img;
  }

  /* ---------- 注音 ---------- */
  var Z = window.ZHUYIN;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // 把一段文字變成「國字＋右側直排注音」的 HTML
  function zy(text) {
    text = String(text);
    if (!state.zhuyin) return esc(text);
    var reads = Z.read(text), out = "";
    for (var i = 0; i < text.length; i++) {
      var c = text[i], r = reads[i];
      if (!r) { out += esc(c); continue; }
      var light = r.charAt(0) === "˙";
      var body = light ? r.slice(1) : r;
      var tone = "", last = body.charAt(body.length - 1);
      if ("ˊˇˋ".indexOf(last) >= 0) { tone = last; body = body.slice(0, -1); }
      // 調號自己畫（不靠字型），固定標在最後一個注音符號的右上方
      var syms = body.split("");
      var col = (light ? '<i class="lt">˙</i>' : "") + syms.map(function (s, j) {
        return "<i>" + s + (tone && j === syms.length - 1 ? toneSvg(tone, syms.length === 1) : "") + "</i>";
      }).join("");
      out += '<span class="zy"><span class="h">' + c + '</span><span class="b' + (tone ? " t" : "") + '"><span class="col">' + col + "</span></span></span>";
    }
    return out;
  }
  // 調號圖形（10×10 座標）：ˊ 由左下往右上、ˋ 由左上往右下、ˇ 為 V 形
  var TONE_PATH = { "ˊ": [[3, 9], [7, 1]], "ˋ": [[3, 1], [7, 9]], "ˇ": [[2.2, 1.5], [5, 8.5], [7.8, 1.5]] };
  function toneSvg(t, single) {
    var pts = TONE_PATH[t].map(function (p) { return p.join(","); }).join(" ");
    return '<svg class="tn' + (single ? " one" : "") + '" viewBox="0 0 10 10" aria-hidden="true"><polyline points="' + pts + '"/></svg>';
  }
  function toneDraw(ctx, t, cx, cy, s) { // 以 (cx,cy) 為中心、邊長 s 畫調號
    var pts = TONE_PATH[t];
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = s * 0.15; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var px = cx + (pts[i][0] - 5) / 10 * s, py = cy + (pts[i][1] - 5) / 10 * s;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  // 在畫布上畫有注音的文字（站牌、集點卡用）
  function zyMeasure(ctx, text, size) {
    var w = 0, reads = state.zhuyin ? Z.read(text) : [];
    ctx.font = "bold " + size + "px " + FONT;
    for (var i = 0; i < text.length; i++) w += reads[i] ? size * 1.42 : ctx.measureText(text[i]).width;
    return w;
  }
  function zyDraw(ctx, text, x, y, size, color) {
    var reads = state.zhuyin ? Z.read(text) : [];
    ctx.fillStyle = color || "#3b2f2a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (var i = 0; i < text.length; i++) {
      var c = text[i], r = reads[i];
      ctx.font = "bold " + size + "px " + FONT;
      if (!r) { ctx.fillText(c, x, y); x += ctx.measureText(c).width; continue; }
      ctx.fillText(c, x, y);
      var light = r.charAt(0) === "˙", body = light ? r.slice(1) : r, tone = "";
      if ("ˊˇˋ".indexOf(body.charAt(body.length - 1)) >= 0) { tone = body.charAt(body.length - 1); body = body.slice(0, -1); }
      var zs = size * 0.3, n = body.length + (light ? 1 : 0), top = y - (n * zs * 1.02) / 2 + zs / 2;
      ctx.font = zs + "px " + FONT;
      ctx.textAlign = "center";
      var cx = x + size * 1.13, k = 0;
      if (light) { ctx.fillText("˙", cx, top); k++; }
      for (var j = 0; j < body.length; j++, k++) ctx.fillText(body[j], cx, top + k * zs * 1.02);
      // 調號：最後一個符號的右上方（多個符號時在最後兩個符號交界處的右側）
      if (tone) toneDraw(ctx, tone, cx + zs * 0.68, top + (k - 1) * zs * 1.02 - zs * (body.length === 1 ? 0.3 : 0.55), zs * 0.45);
      ctx.textAlign = "left";
      x += size * 1.42;
    }
  }
  var FONT = "'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif";

  /* ---------- 照片（老師設定，存在這台裝置的 IndexedDB） ---------- */
  var photos = {}; // id -> dataURL
  var DB = null;
  function dbOpen(cb) {
    try {
      var rq = indexedDB.open("community-walk-photos", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("photos"); };
      rq.onsuccess = function () { DB = rq.result; cb(); };
      rq.onerror = function () { cb(); };
    } catch (e) { cb(); }
  }
  function dbAll(cb) {
    if (!DB) return cb();
    try {
      var tx = DB.transaction("photos", "readonly"), store = tx.objectStore("photos");
      var rq = store.openCursor();
      rq.onsuccess = function () {
        var cur = rq.result;
        if (cur) { photos[cur.key] = cur.value; cur.continue(); } else cb();
      };
      rq.onerror = function () { cb(); };
    } catch (e) { cb(); }
  }
  function dbPut(id, val) {
    if (!DB) return;
    try {
      var tx = DB.transaction("photos", "readwrite");
      if (val) tx.objectStore("photos").put(val, id); else tx.objectStore("photos").delete(id);
    } catch (e) {}
  }
  function resizeImage(file, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 720, w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL("image/jpeg", 0.8));
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  /* ---------- 3D 場景 ---------- */
  var canvas = $("scene");
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    $("err").style.display = "grid";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd6ecfb);
  scene.fog = new THREE.Fog(0xd6ecfb, 80, 170);
  var camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9c8f78, 0.5));
  var sun = new THREE.DirectionalLight(0xfff1dc, 0.62);
  sun.position.set(-30, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 4;
  scene.add(sun);

  var matCache = {};
  function mat(color) {
    if (!matCache[color]) matCache[color] = new THREE.MeshLambertMaterial({ color: color });
    return matCache[color];
  }
  // 圓角方塊：讓建築看起來圓潤（太薄的板子維持一般方塊）
  var geoCache = {};
  function roundedBoxGeo(w, h, d) {
    var key = [w, h, d].map(function (v) { return v.toFixed(2); }).join(",");
    if (geoCache[key]) return geoCache[key];
    var r = Math.min(0.28, Math.min(w, h, d) * 0.18);
    var sw = w / 2 - r, sd = d / 2 - r, cr = r * 0.9;
    var shape = new THREE.Shape();
    shape.moveTo(-sw + cr, -sd);
    shape.lineTo(sw - cr, -sd); shape.quadraticCurveTo(sw, -sd, sw, -sd + cr);
    shape.lineTo(sw, sd - cr); shape.quadraticCurveTo(sw, sd, sw - cr, sd);
    shape.lineTo(-sw + cr, sd); shape.quadraticCurveTo(-sw, sd, -sw, sd - cr);
    shape.lineTo(-sw, -sd + cr); shape.quadraticCurveTo(-sw, -sd, -sw + cr, -sd);
    var g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 3 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, r - h / 2, 0);
    g.computeVertexNormals();
    geoCache[key] = g;
    return g;
  }
  function box(w, h, d, color, x, y, z, parent) {
    var round = Math.min(w, h, d) >= 0.6;
    var m = new THREE.Mesh(round ? roundedBoxGeo(w, h, d) : new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    (parent || scene).add(m);
    return m;
  }
  function cyl(rt, rb, h, color, x, y, z, parent, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat(color));
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    (parent || scene).add(m);
    return m;
  }
  function ball(r, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    (parent || scene).add(m);
    return m;
  }
  function gable(r, len, color, y, parent, x, z) {
    var g = new THREE.CylinderGeometry(r, r, len, 3);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2); // 沿 x 方向延伸、三角形尖端朝上
    var m = new THREE.Mesh(g, mat(color));
    m.position.set(x || 0, y + r / 2, z || 0);
    (parent || scene).add(m);
    return m;
  }
  function pyramid(r, h, color, y, parent, x, z) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat(color));
    m.rotation.y = Math.PI / 4;
    m.position.set(x || 0, y + h / 2, z || 0);
    (parent || scene).add(m);
    return m;
  }

  var ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0xb5dc96));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  var PARK = { x: 10.5, z: 2, w: 7.5, d: 26 };
  var parkLawn = new THREE.Mesh(new THREE.PlaneGeometry(PARK.w, PARK.d), mat(0xa5d686));
  parkLawn.rotation.x = -Math.PI / 2;
  parkLawn.position.set(PARK.x, 0.02, PARK.z);
  scene.add(parkLawn);

  /* ---------- 路線 ---------- */
  var pts = TOUR.route.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  var cum = [0];
  var i;
  for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  var total = cum[cum.length - 1];
  function pointAt(s) {
    s = Math.max(0, Math.min(total, s));
    for (var i = 1; i < pts.length; i++) {
      if (s <= cum[i]) {
        var t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return { p: pts[i - 1].clone().lerp(pts[i], t), d: pts[i].clone().sub(pts[i - 1]).normalize() };
      }
    }
    return { p: pts[pts.length - 1].clone(), d: new THREE.Vector3(1, 0, 0) };
  }
  function distToRoute(x, z) {
    var best = 1e9, P = new THREE.Vector3(x, 0, z);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], ab = b.clone().sub(a);
      var t = Math.max(0, Math.min(1, P.clone().sub(a).dot(ab) / ab.lengthSq()));
      best = Math.min(best, a.clone().add(ab.multiplyScalar(t)).distanceTo(P));
    }
    return best;
  }
  // 是否在路線圍起來的中間區域
  function insideLoop(x, z) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  var roadMat = mat(0xf3d7a0);
  for (i = 1; i < pts.length; i++) {
    var a = pts[i - 1], b = pts[i];
    var seg = new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b), 0.08, 2.6), roadMat);
    seg.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    scene.add(seg);
  }
  for (i = 0; i < pts.length; i++) {
    var jn = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 18), roadMat);
    jn.position.set(pts[i].x, 0.05, pts[i].z);
    scene.add(jn);
  }
  for (var s = 0; s < total; s += 1.6) {
    var q = pointAt(s);
    var dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.18), mat(0xffffff));
    dash.position.set(q.p.x, 0.1, q.p.z);
    dash.rotation.y = -Math.atan2(q.d.z, q.d.x);
    scene.add(dash);
  }

  /* ---------- 地標建築 ---------- */
  var pickables = [];
  var leafCache = {};
  function leafMat(color) {
    if (!leafCache[color]) leafCache[color] = new THREE.MeshStandardMaterial({ color: color, flatShading: true, roughness: 0.9 });
    return leafCache[color];
  }
  function tree(x, z, sc, parent) {
    sc = sc || 1;
    var g = new THREE.Group();
    cyl(0.18 * sc, 0.25 * sc, 1.2 * sc, 0x8a6142, 0, 0, 0, g, 6);
    // 低多邊形的樹冠（像政策島那種切面感）
    var greens = [0x6cb565, 0x5aa35f, 0x7dbf6a];
    var c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leafMat(greens[Math.floor(rnd() * 3)]));
    c.scale.set(sc * (0.95 + rnd() * 0.2), sc * (1.1 + rnd() * 0.3), sc * (0.95 + rnd() * 0.2));
    c.rotation.y = rnd() * 3;
    c.position.y = 1.9 * sc;
    g.add(c);
    g.position.set(x, 0, z);
    (parent || scene).add(g);
    return g;
  }

  function facadeTexture() {
    var cv = document.createElement("canvas");
    cv.width = 1024; cv.height = 512;
    var c = cv.getContext("2d");
    c.fillStyle = "#8a2f2f"; c.fillRect(0, 0, 1024, 512);
    for (var f = 0; f < 4; f++) {
      var y = 40 + f * 112;
      c.fillStyle = "#f1ece4"; c.fillRect(0, y + 84, 1024, 12); // 白色樓板線
      for (var w = 0; w < 10; w++) {
        if (f === 0 && (w === 4 || w === 5)) continue;
        var x = 30 + w * 98;
        c.fillStyle = "#f1ece4"; c.fillRect(x, y, 82, 70);
        c.fillStyle = "#6f8fa8"; c.fillRect(x + 6, y + 6, 32, 58); c.fillRect(x + 44, y + 6, 32, 58);
      }
    }
    // 校名與大門
    c.fillStyle = "#f6f1e8"; c.font = "bold 64px " + FONT; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("三 玉 國 小", 512, 120);
    c.fillStyle = "#c9c4bb"; c.fillRect(420, 380, 184, 132);
    c.fillStyle = "#4a3b33"; c.fillRect(440, 400, 144, 112);
    var t = new THREE.CanvasTexture(cv);
    return t;
  }

  var BUILD = {
    // 三玉國小：依空拍圖配置（南邊是校門，往北依序是前棟、長廊棟、中庭、操場）
    school: function (g) {
      // 前棟（紅磚色、四層樓，正面用畫的窗戶與校名）
      var face = facadeTexture();
      var side = mat(0x7a2e2e);
      var front = new THREE.Mesh(new THREE.BoxGeometry(11, 5.4, 3), [side, side, mat(0xe9e4dc), side, new THREE.MeshLambertMaterial({ map: face }), side]);
      front.position.set(0, 2.7, 7.5);
      g.add(front);
      box(11.4, 0.3, 3.4, 0xe9e4dc, 0, 5.4, 7.5, g);
      // 左前方的白色高樓
      box(3.4, 7, 4, 0xe6e8ea, -7.4, 0, 7, g);
      for (var f = 1; f < 7; f += 1.5) box(3.45, 0.5, 4.05, 0xc9ced3, -7.4, f, 7, g);
      // 校門：紅色伸縮門、兩側磚牆和花台
      box(3, 1.1, 0.4, 0xd8392b, 0, 0, 10.6, g);
      box(3.4, 1.3, 0.8, 0x7b4a35, -3.4, 0, 10.4, g);
      box(3.4, 1.3, 0.8, 0x7b4a35, 3.4, 0, 10.4, g);
      ball(0.9, 0x4f9a55, -2.2, 1.5, 9.8, g);
      ball(0.9, 0x4f9a55, 2.2, 1.5, 9.8, g);
      box(0.5, 1.6, 0.5, 0x8a8f96, 0, 0, 9.3, g);
      // 中間的長廊棟
      box(13, 3, 2.4, 0xefe7d8, 0, 0, 2, g);
      box(13.3, 0.25, 2.7, 0xffffff, 0, 3, 2, g);
      // 中庭棟（中間是藍綠色球場）
      box(8, 2.8, 1.4, 0xefe7d8, 0, 0, -1.6, g);
      box(8, 2.8, 1.4, 0xefe7d8, 0, 0, -7.4, g);
      box(1.4, 2.8, 4.4, 0xefe7d8, -3.3, 0, -4.5, g);
      box(1.4, 2.8, 4.4, 0xefe7d8, 3.3, 0, -4.5, g);
      var court = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4), mat(0x3f9c9a));
      court.rotation.x = -Math.PI / 2; court.position.set(0, 0.08, -4.5); g.add(court);
      // 操場：紅色跑道、綠色足球場
      var trackM = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(0xb5543f));
      trackM.rotation.x = -Math.PI / 2; trackM.scale.set(3.6, 6.2, 1); trackM.position.set(-3.3, 0.07, -15); g.add(trackM);
      var field = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 8.4), mat(0x58a85a));
      field.rotation.x = -Math.PI / 2; field.position.set(-3.3, 0.09, -15); g.add(field);
      // 操場右邊的白色屋頂
      for (var r = 0; r < 3; r++) {
        box(5, 1.6, 2.6, 0xf2f2f0, 4.2, 0, -19 + r * 2.9, g);
        gable(1.5, 5.2, 0xffffff, 1.6, g, 4.2, -19 + r * 2.9).scale.set(1, 0.4, 1);
      }
      for (var tz = -10; tz <= 4; tz += 3.5) { tree(-7.8, tz, 0.8, g); tree(7.8, tz, 0.8, g); }
    },
    temple: function (g) {
      box(5, 0.5, 4.2, 0xd9c7a8, 0, 0, 0, g);
      box(4.4, 2.2, 3.4, 0xc8402f, 0, 0.5, 0, g);
      box(5.6, 0.3, 4.4, 0xe2a03f, 0, 2.7, 0, g);
      var r = gable(2.4, 5.8, 0x2f8a6d, 2.9, g);
      r.scale.set(1, 0.6, 1.15);
      r.position.y = 2.9 + 0.6 * 1.2;
      box(5.2, 0.25, 0.25, 0xf6c445, 0, 4.95, 0, g);
      ball(0.35, 0xe2382b, -1.6, 2.3, 1.95, g);
      ball(0.35, 0xe2382b, 1.6, 2.3, 1.95, g);
      cyl(0.5, 0.35, 0.8, 0xc9a640, 0, 0, 3.2, g);
      box(1.1, 1.6, 0.1, 0x8a2a1f, 0, 0.5, 1.72, g);
    },
    bank: function (g) {
      box(5.6, 0.4, 4, 0xd7d2c8, 0, 0, 0, g);
      box(5, 3.2, 3.4, 0xf1ede4, 0, 0.4, 0, g);
      for (var k = -1.8; k <= 1.8; k += 1.2) cyl(0.2, 0.2, 2.8, 0xffffff, k, 0.4, 1.9, g, 10);
      box(5.6, 0.5, 4.2, 0x2e7d6b, 0, 3.6, 0, g);
      box(3.6, 0.6, 0.1, 0x2e7d6b, 0, 2.6, 2.3, g);
      box(0.9, 1.5, 0.6, 0x8c9aa6, 2.9, 0, 2.2, g); // 提款機
      box(0.6, 0.4, 0.05, 0x9fd3ef, 2.9, 0.9, 2.52, g);
    },
    post: function (g) {
      box(5, 3, 3.6, 0xeff0e6, 0, 0, 0, g);
      box(5.2, 0.6, 3.8, 0x2f8a4f, 0, 3, 0, g);
      box(4.4, 0.5, 0.1, 0x2f8a4f, 0, 2.2, 1.82, g);
      box(2, 1.6, 0.1, 0x9fc6de, 0, 0, 1.82, g);
      cyl(0.32, 0.32, 1.2, 0xd8392b, 2.9, 0, 2.6, g);
      cyl(0.32, 0.32, 1.2, 0x2f8a4f, 3.7, 0, 2.6, g);
    },
    police: function (g) {
      box(5, 3.4, 3.6, 0xf3f5f8, 0, 0, 0, g);
      box(5.05, 0.6, 3.65, 0x2f5fa8, 0, 2.2, 0, g);
      box(1.4, 1.7, 0.1, 0x6d8fb7, 0, 0, 1.82, g);
      box(0.5, 0.35, 0.5, 0xe2382b, -0.4, 3.4, 0, g);
      box(0.5, 0.35, 0.5, 0x2f6fe0, 0.4, 3.4, 0, g);
      for (var k = 0; k < 3; k++) {
        box(1.1, 0.5, 0.35, 0xffffff, -1.6 + k * 1.6, 0.3, 2.7, g);
        ball(0.25, 0x333333, -2.05 + k * 1.6, 0.25, 2.7, g);
        ball(0.25, 0x333333, -1.15 + k * 1.6, 0.25, 2.7, g);
      }
    },
    fire: function (g) {
      box(6, 3.8, 4, 0xd8473a, 0, 0, 0, g);
      box(1.8, 2.4, 0.1, 0x555b66, -1.3, 0, 2.02, g);
      box(1.8, 2.4, 0.1, 0x555b66, 1.3, 0, 2.02, g);
      box(1.6, 6.5, 1.6, 0xc23c31, 2.6, 0, -1.4, g);
      box(6.3, 0.3, 4.3, 0xf3f3f3, 0, 3.8, 0, g);
      box(2.6, 1.1, 1.2, 0xe2382b, -1, 0.3, 3.5, g);
      box(0.9, 0.7, 1.15, 0xbfe0ff, 0.1, 1.0, 3.5, g);
      ball(0.3, 0x333333, -1.9, 0.3, 4.1, g);
      ball(0.3, 0x333333, -0.1, 0.3, 4.1, g);
    },
    library: function (g) {
      box(6.4, 3.2, 4, 0xc49a6c, 0, 0, 0, g);
      box(5, 2, 0.1, 0xbfe3f2, 0, 0.4, 2.02, g);
      var colors = [0xe8704a, 0x4a7fc1, 0xf6c445, 0x3f9b5f];
      for (var k = 0; k < 4; k++) box(3 - k * 0.4, 0.45, 2, colors[k], 0, 3.2 + k * 0.45, 0, g);
      box(0.9, 1, 0.7, 0x4a7fc1, -3.8, 0, 1.8, g); // 還書箱
    },
    river: function (g) {
      // 溪邊的木頭觀景台
      box(3, 0.3, 2.2, 0xa9784f, 0, 0.3, 0, g);
      for (var a = -1; a <= 1; a += 2) for (var b = -1; b <= 1; b += 2) cyl(0.1, 0.1, 0.6, 0x8a6142, a * 1.3, 0, b * 0.9, g, 6);
      box(3, 0.6, 0.1, 0x8a6142, 0, 0.6, -1.05, g);
      ball(0.45, 0x9a9a92, 1.9, 0.2, 0.8, g);
      ball(0.35, 0xa8a69c, -1.9, 0.15, 1.0, g);
    },
    park: function (g) {
      for (var a = -1; a <= 1; a += 2) for (var b = -1; b <= 1; b += 2) cyl(0.12, 0.12, 2.2, 0xa0522d, a * 1.3, 0, b * 1.3, g, 6);
      pyramid(2.6, 1.5, 0xc95a49, 2.2, g);
      box(1.6, 0.4, 0.8, 0x8a6142, 0, 0.4, 0, g);
      box(0.8, 1.6, 0.8, 0xf6c445, 0, 0, -4.5, g);
      var sl = box(0.8, 0.12, 2.6, 0x4a7fc1, 0, 0.8, -3.2, g);
      sl.rotation.x = 0.55;
    }
  };

  /* ---------- 站牌 ---------- */
  var signs = [];
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function drawSign(k) {
    var sg = signs[k], c = sg.ctx, W = 640, H = 220;
    var st = stationStatus(k);
    c.clearRect(0, 0, W, H);
    var bg = { locked: "#ece6dc", next: "#ffe58a", here: "#ffd2b8", done: "#cfeeda" }[st];
    var bd = { locked: "#b6ab9c", next: "#e8a33a", here: "#e8704a", done: "#3f9b5f" }[st];
    roundRect(c, 8, 8, W - 16, 168, 36);
    c.fillStyle = bg; c.fill();
    c.lineWidth = 10; c.strokeStyle = bd; c.stroke();
    c.beginPath(); c.moveTo(W / 2 - 22, 174); c.lineTo(W / 2, 210); c.lineTo(W / 2 + 22, 174); c.closePath();
    c.fillStyle = bd; c.fill();
    var name = ST[k].name;
    var fs = 60;
    while (fs > 26 && fs * 1.3 + zyMeasure(c, name, fs) > W - 70) fs -= 3;
    var wName = zyMeasure(c, name, fs), wAll = fs * 1.3 + wName, x0 = (W - wAll) / 2;
    var img = st === "done" ? checkImg : sg.icon;
    if (img && img.complete && img.naturalWidth) c.drawImage(img, x0, 94 - fs * 0.6, fs * 1.15, fs * 1.15);
    zyDraw(c, name, x0 + fs * 1.3, 94, fs);
    sg.tex.needsUpdate = true;
  }

  var buildings = [];
  var checkImg = svgImg(ART.check());
  checkImg.onload = function () { signs.forEach(function (_, k) { drawSign(k); }); };
  ST.forEach(function (stn, k) {
    var g = new THREE.Group();
    g.position.set(stn.pos[0], 0, stn.pos[1]);
    var near = pts[stn.at];
    g.rotation.y = stn.rot != null ? stn.rot : Math.atan2(near.x - stn.pos[0], near.z - stn.pos[1]);
    if (!stn.noBuilding && BUILD[stn.kind]) { BUILD[stn.kind](g); if (stn.kind !== "school") g.scale.setScalar(1.15); }
    scene.add(g);
    buildings[k] = g;
    g.traverse(function (o) { if (o.isMesh) { o.userData.station = k; pickables.push(o); } });

    var cv = document.createElement("canvas");
    cv.width = 640; cv.height = 220;
    var tex = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.renderOrder = 10;
    var high = stn.noBuilding ? 4.6 : stn.kind === "river" ? 4.6 : 9;
    sp.position.set(stn.pos[0], high, stn.pos[1]);
    sp.userData.station = k;
    sp.userData.baseY = high;
    scene.add(sp);
    pickables.push(sp);
    signs[k] = { sprite: sp, ctx: cv.getContext("2d"), tex: tex, photo: null, icon: svgImg(ART.iconFor(stn)) };
    signs[k].icon.onload = function () { drawSign(k); };
  });

  // 照片立牌：老師匯入照片後，掛在地標上方
  function photoSprite(k) {
    var sg = signs[k];
    if (sg.photo) { scene.remove(sg.photo); sg.photo = null; }
    var url = photos[ST[k].id];
    sg.sprite.userData.baseY = (ST[k].noBuilding || ST[k].kind === "river") ? 4.6 : 9;
    if (!url || ST[k].noBuilding) return;
    var img = new Image();
    img.onload = function () {
      var W = 512, H = Math.round(512 * img.height / img.width);
      H = Math.max(260, Math.min(H, 560));
      var cv = document.createElement("canvas");
      cv.width = W + 40; cv.height = H + 40;
      var c = cv.getContext("2d");
      c.fillStyle = "#fffaf0"; roundRect(c, 0, 0, cv.width, cv.height, 26); c.fill();
      c.save(); roundRect(c, 20, 20, W, H, 14); c.clip();
      var s = Math.max(W / img.width, H / img.height);
      c.drawImage(img, 20 + (W - img.width * s) / 2, 20 + (H - img.height * s) / 2, img.width * s, img.height * s);
      c.restore();
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
      var h = 4.2, w = h * cv.width / cv.height;
      sp.scale.set(w, h, 1);
      sp.position.set(ST[k].pos[0], 7.4, ST[k].pos[1]);
      sp.renderOrder = 9;
      sp.userData.station = k;
      scene.add(sp);
      pickables.push(sp);
      sg.photo = sp;
      sg.sprite.userData.baseY = 7.4 + h / 2 + 1.6;
    };
    img.src = url;
  }

  var ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  scene.add(ring);

  /* ---------- 玉潮坑溪 ---------- */
  var rpts = (TOUR.river || []).map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  var waterMat = new THREE.MeshLambertMaterial({ color: 0x67bfe3 });
  for (i = 1; i < rpts.length; i++) {
    var ra = rpts[i - 1], rb = rpts[i];
    var rs = new THREE.Mesh(new THREE.BoxGeometry(ra.distanceTo(rb) + 0.6, 0.06, 1.7), waterMat);
    rs.position.set((ra.x + rb.x) / 2, 0.03, (ra.z + rb.z) / 2);
    rs.rotation.y = -Math.atan2(rb.z - ra.z, rb.x - ra.x);
    scene.add(rs);
  }
  // 過馬路的小木橋
  (function () {
    if (rpts.length < 2) return;
    var bridge = new THREE.Group();
    box(2.8, 0.12, 3.4, 0xb98756, 0, 0.12, 0, bridge);
    box(0.12, 0.5, 3.4, 0x8a6142, -1.35, 0.24, 0, bridge);
    box(0.12, 0.5, 3.4, 0x8a6142, 1.35, 0.24, 0, bridge);
    bridge.position.set(11.2, 0, 25.45);
    bridge.rotation.y = 0.35;
    scene.add(bridge);
  })();
  function distToRiver(x, z) {
    var best = 1e9, P = new THREE.Vector3(x, 0, z);
    for (var i = 1; i < rpts.length; i++) {
      var a = rpts[i - 1], b = rpts[i], ab = b.clone().sub(a);
      var t = Math.max(0, Math.min(1, P.clone().sub(a).dot(ab) / ab.lengthSq()));
      best = Math.min(best, a.clone().add(ab.multiplyScalar(t)).distanceTo(P));
    }
    return best;
  }

  /* ---------- 中間：老地名「三角埔」 ---------- */
  var CENTER = { x: -6, z: 13 };
  var centerPick = [];
  if (TOUR.center) {
    var post = new THREE.Group();
    cyl(0.18, 0.2, 3.2, 0x8a6142, -1.6, 0, 0, post, 8);
    cyl(0.18, 0.2, 3.2, 0x8a6142, 1.6, 0, 0, post, 8);
    box(4.2, 1.4, 0.25, 0xd9b27c, 0, 1.8, 0, post);
    post.position.set(CENTER.x, 0, CENTER.z);
    scene.add(post);
    // 小小的田地，表示「埔」是一片平地
    [[-3.5, -3], [0, -3.4], [3.4, -3], [-2, 3], [2, 3.2]].forEach(function (p) {
      var f = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), mat(0xb7d98a));
      f.rotation.x = -Math.PI / 2;
      f.position.set(CENTER.x + p[0], 0.05, CENTER.z + p[1]);
      scene.add(f);
    });
    var ccv = document.createElement("canvas");
    ccv.width = 640; ccv.height = 300;
    var ctex = new THREE.CanvasTexture(ccv);
    var csp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, depthTest: false }));
    csp.renderOrder = 8;
    csp.position.set(CENTER.x, 6.2, CENTER.z);
    scene.add(csp);
    post.traverse(function (o) { if (o.isMesh) { o.userData.center = true; pickables.push(o); } });
    csp.userData.center = true;
    pickables.push(csp);
    centerPick.push(csp);
  }
  function drawCenter() {
    if (!TOUR.center) return;
    var csp = centerPick[0], c = csp.material.map.image.getContext("2d"), W = 640;
    c.clearRect(0, 0, W, 300);
    c.fillStyle = "#fff4dc"; roundRect(c, 10, 10, W - 20, 250, 40); c.fill();
    c.lineWidth = 12; c.strokeStyle = "#a9784f"; c.stroke();
    var nm = TOUR.center.name, fs = 96, w = zyMeasure(c, nm, fs);
    zyDraw(c, nm, (W - w) / 2, 112, fs, "#5a3d28");
    var nt = TOUR.center.note, w2 = zyMeasure(c, nt, 40);
    zyDraw(c, nt, (W - w2) / 2, 210, 40, "#a9784f");
    csp.material.map.needsUpdate = true;
  }

  /* ---------- 公園的樹、外圍的房子（刻意放少、顏色放淡） ---------- */
  var parkIdx = ST.findIndex(function (s) { return s.kind === "park"; });
  for (i = 0; i < 24; i++) {
    var tx = PARK.x - PARK.w / 2 + 0.8 + rnd() * (PARK.w - 1.6);
    var tz = PARK.z - PARK.d / 2 + 0.8 + rnd() * (PARK.d - 1.6);
    if (Math.hypot(tx - ST[parkIdx].pos[0], tz - ST[parkIdx].pos[1]) < 5.5) continue;
    if (distToRoute(tx, tz) < 2.2 || distToRiver(tx, tz) < 1.6) continue;
    tree(tx, tz, 0.8 + rnd() * 0.4);
  }
  var wallColors = [0xf4eee3, 0xece6db, 0xf1e6d6];
  var roofColors = [0xd9a89c, 0xb7c4d3, 0xc8bba9];
  function nearStation(x, z, r) {
    for (var k = 0; k < ST.length; k++) if (Math.hypot(x - ST[k].pos[0], z - ST[k].pos[1]) < r) return true;
    return false;
  }
  for (var hx = -40; hx <= 40; hx += 6) {
    for (var hz = -38; hz <= 40; hz += 6) {
      var x = hx + (rnd() - 0.5) * 2, z = hz + (rnd() - 0.5) * 2;
      if (rnd() < 0.4) continue;
      if (distToRoute(x, z) < 5.5 || nearStation(x, z, 7.5) || insideLoop(x, z) || distToRiver(x, z) < 3) continue;
      if (x > 14.5 && x < 33.5 && z > -14 && z < 25) continue; // 學校校地
      if (Math.abs(x - PARK.x) < PARK.w / 2 + 2 && Math.abs(z - PARK.z) < PARK.d / 2 + 2) continue;
      if (rnd() < 0.35) { tree(x, z, 0.9); continue; }
      var hg = new THREE.Group();
      var hh = 1.4 + rnd() * 1.6, w = 2.6 + rnd() * 1.2, d = 2.6 + rnd();
      box(w, hh, d, wallColors[Math.floor(rnd() * wallColors.length)], 0, 0, 0, hg);
      gable(d / 1.6, w + 0.2, roofColors[Math.floor(rnd() * roofColors.length)], hh, hg);
      hg.position.set(x, 0, z);
      hg.rotation.y = Math.floor(rnd() * 4) * Math.PI / 2;
      scene.add(hg);
    }
  }
  // 中間空地：只放幾棵樹點綴
  [[-12, 4], [-15, 22], [0.5, 23], [-1, 1]].forEach(function (p) { if (insideLoop(p[0], p[1]) && distToRoute(p[0], p[1]) > 2) tree(p[0], p[1], 0.9); });
  for (i = 0; i < 50; i++) {
    var ang = rnd() * Math.PI * 2, rr = 50 + rnd() * 25;
    tree(Math.cos(ang) * rr, Math.sin(ang) * rr, 1 + rnd() * 0.6);
  }

  /* ---------- 人物 ---------- */
  function person(shirt, hat) {
    var g = new THREE.Group();
    cyl(0.32, 0.38, 0.9, shirt, 0, 0.35, 0, g);
    cyl(0.12, 0.12, 0.4, 0x3b4a6b, -0.15, 0, 0, g, 6);
    cyl(0.12, 0.12, 0.4, 0x3b4a6b, 0.15, 0, 0, g, 6);
    ball(0.36, 0xf5d3b3, 0, 1.6, 0, g);
    // 臉：眼睛、腮紅、笑臉
    ball(0.055, 0x1b2836, -0.12, 1.66, 0.31, g);
    ball(0.055, 0x1b2836, 0.12, 1.66, 0.31, g);
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 12, Math.PI), mat(0x1b2836));
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 1.53, 0.33);
    g.add(mouth);
    var bl = new THREE.MeshBasicMaterial({ color: 0xf9a8a8 });
    [-0.2, 0.2].forEach(function (bx) { var b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bl); b.scale.set(1, 0.6, 0.4); b.position.set(bx, 1.55, 0.3); g.add(b); });
    if (!hat) {
      var hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0x3b2a20));
      hair.position.y = 1.62; hair.rotation.x = -0.25;
      g.add(hair);
    }
    if (hat) {
      cyl(0.48, 0.48, 0.06, hat, 0, 1.78, 0, g, 16);
      var top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat));
      top.position.y = 1.8;
      g.add(top);
    }
    scene.add(g);
    return g;
  }
  var kid = person(0x4a7fc1, 0xf6c445);
  box(0.5, 0.6, 0.25, 0xe8704a, 0, 0.55, -0.38, kid);
  kid.scale.setScalar(1.4);
  var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.11;
  scene.add(shadow);

  var walkers = [];
  [[0xd8473a, null, [-30, 6], [-30, 18]], [0x3f9b5f, 0x8a6142, [12.5, -8], [12.5, 10]], [0x9a6fc1, null, [16, 31], [2, 31]], [0xf0a030, null, [-16, -32], [-16, -22]]]
    .forEach(function (w) {
      var p = person(w[0], w[1]);
      walkers.push({ obj: p, a: new THREE.Vector3(w[2][0], 0, w[2][1]), b: new THREE.Vector3(w[3][0], 0, w[3][1]), t: rnd() });
    });

  /* ---------- 進度判斷 ---------- */
  var walking = false;
  function nextIndex() {
    for (var k = 0; k < ST.length; k++) if (!state.done[ST[k].id]) return k;
    return -1;
  }
  function stationStatus(k) {
    if (state.done[ST[k].id]) return "done";
    if (k === state.at && !walking) return "here";
    if (k === nextIndex() || state.teacher) return "next";
    return "locked";
  }

  /* ---------- 走路 ---------- */
  var walkS = cum[ST[state.at].at];
  var walkTarget = walkS;
  var arriveCb = null;
  function walkTo(k, cb) {
    closeMenu();
    walkTarget = cum[ST[k].at];
    walking = true;
    state.at = k;
    arriveCb = cb;
    camMode = "follow";
    $("viewBtn").classList.remove("on");
    refresh();
  }

  /* ---------- 鏡頭 ---------- */
  var camMode = "follow";
  var yaw = 0.5, pitch = 1.0, dist = 30;
  var camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
  function desiredCam() {
    var tgt, d;
    if (camMode === "overview") { tgt = new THREE.Vector3(-2, 0, 0); d = 82; }
    else { tgt = kid.position.clone(); d = dist; }
    return {
      tgt: tgt,
      pos: new THREE.Vector3(tgt.x + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, tgt.z + Math.cos(yaw) * Math.cos(pitch) * d)
    };
  }
  var pointers = {}, dragMoved = 0, pinchStart = 0, distStart = 0;
  canvas.addEventListener("pointerdown", function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    dragMoved = 0;
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var p1 = pointers[ids[0]], p2 = pointers[ids[1]];
      pinchStart = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      distStart = dist;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
  });
  canvas.addEventListener("pointermove", function (e) {
    var p = pointers[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var p1 = pointers[ids[0]], p2 = pointers[ids[1]];
      var now = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (pinchStart > 0) { dist = Math.max(12, Math.min(55, distStart * pinchStart / now)); camMode = "follow"; }
      dragMoved += 20;
      return;
    }
    dragMoved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.008;
    pitch = Math.max(0.45, Math.min(1.35, pitch + dy * 0.005));
  });
  canvas.addEventListener("pointerup", function (e) {
    var wasTap = pointers[e.pointerId] && Object.keys(pointers).length === 1 && dragMoved < 8;
    delete pointers[e.pointerId];
    if (wasTap) tap(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointercancel", function (e) { delete pointers[e.pointerId]; });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    camMode = "follow";
    dist = Math.max(12, Math.min(55, dist * (e.deltaY > 0 ? 1.1 : 0.9)));
  }, { passive: false });

  var ray = new THREE.Raycaster();
  function tap(x, y) {
    ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    var hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    if (hit.object.userData.center) { toast(ART.map(), TOUR.center.tip); return; }
    var k = hit.object.userData.station;
    if (k === 0 && nextIndex() === ST.length - 1) k = ST.length - 1;
    chooseStation(k);
  }
  function chooseStation(k) {
    if (walking) return;
    if (k === state.at) { openStation(k); return; }
    if (state.teacher || k === nextIndex() || state.done[ST[k].id]) {
      walkTo(k, function () { if (!state.done[ST[k].id]) openStation(k); });
    } else toast(ART.kid(), "先完成前面的站，再來這裡喔！");
  }

  /* ---------- 介面 ---------- */
  function setTitle() {
    $("titleText").innerHTML = zy(TOUR.title);
    $("subText").textContent = TOUR.subtitle;
  }
  document.title = TOUR.title + "地圖";
  var stampBox = $("stamps");
  ST.forEach(function (stn) {
    var s = el("div", "stamp", ART.iconFor(stn));
    s.title = stn.name;
    stampBox.appendChild(s);
  });

  function refresh() {
    setTitle();
    ST.forEach(function (stn, k) {
      stampBox.children[k].classList.toggle("done", !!state.done[stn.id]);
      drawSign(k);
    });
    drawCenter();
    var go = $("goBtn"), n = nextIndex();
    go.disabled = walking;
    var label;
    if (walking) label = "走路中…";
    else if (n === -1) label = "踏查完成！";
    else if (n === state.at) label = "開始任務：" + ST[n].name;
    else label = "▶ 走到下一站：" + ST[n].name;
    go.innerHTML = zy(label);
    var ns = n === -1 ? null : ST[n];
    ring.visible = !!ns && !walking;
    if (ns) ring.position.set(pts[ns.at].x, 0.12, pts[ns.at].z);
    document.body.classList.toggle("big", !!state.big);
    $("bigBtn").classList.toggle("on", !!state.big);
    $("zyBtn").textContent = state.zhuyin ? "ㄅ 注音：開（按一下關閉）" : "ㄅ 注音：關（按一下打開）";
    $("teacherBtn").textContent = state.teacher ? "🔒 關閉老師模式" : "🔓 老師模式（每站都能去）";
    var jl = $("jumpList");
    jl.innerHTML = "";
    if (state.teacher) {
      ST.forEach(function (stn, k) {
        var b = el("button", "jump", (state.done[stn.id] ? "✅ " : stn.emoji + " ") + stn.name);
        b.onclick = function () { chooseStation(k); };
        jl.appendChild(b);
      });
    }
    save();
  }

  $("goBtn").onclick = function () {
    var n = nextIndex();
    if (walking) return;
    if (n === -1) { toast(ART.kid("cheer"), "全部完成了！可以點站牌再玩一次。"); return; }
    if (n === state.at) openStation(n);
    else walkTo(n, function () { openStation(n); });
  };
  $("viewBtn").onclick = function () {
    camMode = camMode === "overview" ? "follow" : "overview";
    $("viewBtn").classList.toggle("on", camMode === "overview");
  };
  function closeMenu() { $("menu").classList.remove("show"); }
  $("menuBtn").onclick = function () { $("menu").classList.toggle("show"); };
  $("bigBtn").onclick = function () { state.big = !state.big; refresh(); onResize(); };
  $("zyBtn").onclick = function () { state.zhuyin = !state.zhuyin; refresh(); };
  $("teacherBtn").onclick = function () { state.teacher = !state.teacher; refresh(); };
  $("photoBtn").onclick = function () { closeMenu(); openPhotoPanel(); };
  var resetArmed = false;
  $("resetBtn").onclick = function () {
    if (!resetArmed) {
      resetArmed = true;
      $("resetBtn").textContent = "⚠️ 再按一次，清除進度";
      setTimeout(function () { resetArmed = false; $("resetBtn").textContent = "🔄 重新開始"; }, 3000);
      return;
    }
    resetArmed = false;
    $("resetBtn").textContent = "🔄 重新開始";
    state.done = {}; state.at = 0;
    walkS = walkTarget = cum[ST[0].at];
    closeMenu();
    refresh();
  };

  var toastTimer;
  function toast(icon, text) {
    var t = $("toast");
    t.innerHTML = '<span class="big">' + icon + "</span><div>" + zy(text) + "</div>";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2300);
  }

  /* ---------- 老師：照片設定 ---------- */
  function openPhotoPanel() {
    var p = $("photoPanel");
    p.classList.add("show");
    var list = $("photoList");
    list.innerHTML = "";
    ST.forEach(function (stn, k) {
      if (stn.noBuilding) return;
      var row = el("div", "prow");
      var th = el("div", "pthumb");
      if (photos[stn.id]) th.style.backgroundImage = "url(" + photos[stn.id] + ")";
      else th.innerHTML = ART.iconFor(stn);
      row.appendChild(th);
      row.appendChild(el("div", "pname", stn.name));
      var lab = el("label", "pbtn", "選照片");
      var inp = el("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () {
        if (!inp.files[0]) return;
        resizeImage(inp.files[0], function (url) {
          photos[stn.id] = url; dbPut(stn.id, url); photoSprite(k); openPhotoPanel();
        });
      };
      lab.appendChild(inp);
      row.appendChild(lab);
      if (photos[stn.id]) {
        var rm = el("button", "pbtn gray", "移除");
        rm.onclick = function () { delete photos[stn.id]; dbPut(stn.id, null); photoSprite(k); openPhotoPanel(); };
        row.appendChild(rm);
      }
      list.appendChild(row);
    });
  }
  $("photoClose").onclick = function () { $("photoPanel").classList.remove("show"); };
  $("exportBtn").onclick = function () {
    try {
      var blob = new Blob([JSON.stringify({ app: "community-walk", version: 2, title: TOUR.title, photos: photos })], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = TOUR.title + "-照片設定.json";
      document.body.appendChild(a); a.click(); a.remove();
      $("photoMsg").textContent = "已匯出。如果沒有出現下載，請改用 GitHub 網址版開啟。";
    } catch (e) { $("photoMsg").textContent = "這個環境不能下載檔案，請改用 GitHub 網址版開啟。"; }
  };
  $("importInput").onchange = function () {
    var f = this.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        Object.keys(data.photos || {}).forEach(function (id) { photos[id] = data.photos[id]; dbPut(id, photos[id]); });
        ST.forEach(function (_, k) { photoSprite(k); });
        openPhotoPanel();
        $("photoMsg").textContent = "已匯入照片設定。";
      } catch (e) { $("photoMsg").textContent = "這個檔案讀不到，請確認是本工具匯出的設定檔。"; }
    };
    rd.readAsText(f);
  };

  /* ---------- 任務卡 ---------- */
  var cur = null;
  var sheet = $("sheet");
  function openStation(k) {
    closeMenu();
    cur = { k: k, step: 0 };
    $("card").classList.add("show");
    if (state.done[ST[k].id]) {
      head();
      var body = el("div");
      body.appendChild(okMsg("這一站已經完成了！"));
      var again = el("button", "next", zy("再玩一次"));
      again.onclick = function () { cur.step = 0; renderTask(); };
      var close = el("button", "next gray", zy("關閉"));
      close.onclick = closeCard;
      var f = el("div", "foot"); f.appendChild(close); f.appendChild(again); body.appendChild(f);
      sheet.appendChild(body);
      return;
    }
    renderTask();
  }
  function closeCard() {
    $("card").classList.remove("show");
    try { speechSynthesis.cancel(); } catch (e) {}
    cur = null;
    refresh();
  }
  $("card").addEventListener("click", function (e) { if (e.target.id === "card") closeCard(); });

  function head() {
    var stn = ST[cur.k];
    sheet.innerHTML = "";
    if (photos[stn.id]) {
      var ph = el("div", "photo");
      ph.style.backgroundImage = "url(" + photos[stn.id] + ")";
      sheet.appendChild(ph);
    }
    var h = el("div");
    h.id = "sheetHead";
    h.appendChild(el("span", "big", ART.iconFor(stn)));
    h.appendChild(el("h2", "", zy(stn.name)));
    var dots = el("div");
    dots.id = "dots";
    stn.tasks.forEach(function (t, k) { dots.appendChild(el("span", "dot" + (k < cur.step ? " ok" : k === cur.step ? " cur" : ""))); });
    h.appendChild(dots);
    var x = el("button", "speak", "✕");
    x.setAttribute("aria-label", "關閉");
    x.onclick = closeCard;
    h.appendChild(x);
    sheet.appendChild(h);
    if (cur.step === 0 && stn.lookFor) {
      var lf = el("div", "look");
      lf.appendChild(el("span", "lfi", ART.magnifier()));
      lf.appendChild(el("span", "", zy(stn.lookFor)));
      sheet.appendChild(lf);
    }
  }
  function qLine(text, sayText) {
    var d = el("div", "q");
    var b = el("button", "speak", ART.speaker());
    b.setAttribute("aria-label", "念給我聽");
    b.onclick = function () { speak(sayText || text); };
    d.appendChild(b);
    d.appendChild(el("span", "", zy(text)));
    return d;
  }
  function nextBtn(label) {
    var b = el("button", "next", zy(label || "下一題 ▶"));
    b.onclick = function () {
      cur.step++;
      if (cur.step >= ST[cur.k].tasks.length) finishStation();
      else renderTask();
    };
    return b;
  }
  // 每一關的底部列：放「下一題」按鈕，固定在卡片最下面
  function foot(body) {
    var f = body.querySelector(".foot");
    if (!f) { f = el("div", "foot"); body.appendChild(f); }
    return f;
  }
  function scrollEnd() { setTimeout(function () { sheet.scrollTop = sheet.scrollHeight; }, 60); }

  function renderTask() {
    head();
    var t = ST[cur.k].tasks[cur.step];
    var body = el("div", "tbody t-" + t.type);
    sheet.appendChild(body);
    if (t.subject) body.appendChild(el("span", "tag " + t.subject, zy(t.subject)));
    var fn = { info: taskInfo, choice: taskChoice, math: taskMath, order: taskOrder, letter: taskLetter, sort: gameSort, catch: gameCatch, chase: gameChase, run: gameRun, pick2: taskPick2 }[t.type];
    if (t.title && t.story) intro(t, body, fn);
    else fn(t, body);
    sheet.scrollTop = 0;
  }

  // 小遊戲的開場小視窗
  function intro(t, body, fn) {
    var box_ = el("div", "intro");
    box_.appendChild(el("h3", "", zy(t.title)));
    var row = el("div", "introRow");
    row.appendChild(el("div", "host", art(t.host || "kid")));
    var bubble = el("div", "bubble");
    bubble.appendChild(qLine(t.story));
    row.appendChild(bubble);
    box_.appendChild(row);
    var go = el("button", "next", zy("開始 ▶"));
    go.onclick = function () { body.innerHTML = ""; body.appendChild(el("span", "tag " + t.subject, zy(t.subject))); fn(t, body); };
    body.appendChild(box_);
    foot(body).appendChild(go);
  }

  function taskInfo(t, body) {
    body.appendChild(qLine(t.text));
    foot(body).appendChild(nextBtn("知道了 ▶"));
  }

  function choiceBlock(body, q, options, answer, onRight, why) {
    var tries = 0;
    var say = q + "。" + options.map(function (o, k) { return "第" + ZH[k + 1] + "個，" + o; }).join("。");
    if (q) body.appendChild(qLine(q, say));
    var box_ = el("div", "opts");
    var msg = el("div");
    options.forEach(function (o, k) {
      var b = el("button", "opt", zy(o));
      b.onclick = function () {
        if (box_.dataset.locked) return;
        if (k === answer) {
          b.classList.add("right");
          box_.dataset.locked = 1;
          msg.innerHTML = "";
          if (why) msg.appendChild(okMsg("答對了！" + why));
          onRight(tries === 0);
        } else {
          tries++;
          b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong");
          msg.innerHTML = "";
          if (tries >= 2) {
            box_.children[answer].classList.add("right");
            box_.dataset.locked = 1;
            msg.appendChild(hintMsg("答案是「" + options[answer] + "」。" + (why || "")));
            onRight(false);
          } else msg.appendChild(hintMsg("再想想看！"));
        }
      };
      box_.appendChild(b);
    });
    body.appendChild(box_);
    body.appendChild(msg);
  }
  function taskChoice(t, body) {
    choiceBlock(body, t.q, t.options, t.answer, function () { foot(body).appendChild(nextBtn()); }, t.why);
  }

  // 乘法選項：正確（被乘數×乘數）、前後對調、加法；兩個數一樣時改用別的干擾
  function mulForms(per, groups) {
    var f = [per + " × " + groups];
    if (per !== groups) f.push(groups + " × " + per);
    f.push(per + " + " + groups);
    if (f.length < 3) f.push(per + " × " + (groups + 1 <= 9 ? groups + 1 : groups - 1));
    return f;
  }
  function groupPics(item, per, groups) {
    var gs = el("div", "groups");
    for (var g = 0; g < groups; g++) {
      var one = "";
      for (var k = 0; k < per; k++) one += '<span class="it">' + art(item) + "</span>";
      gs.appendChild(el("span", "group", one));
    }
    return gs;
  }
  function taskMath(t, body) {
    body.appendChild(qLine(t.story, t.story + t.ask));
    body.appendChild(groupPics(t.item, t.per, t.groups));
    var ans = t.per * t.groups;
    var area = el("div", "steparea");
    body.appendChild(area);
    var forms = mulForms(t.per, t.groups);
    var order = shuffle([0, 1, 2]);
    area.appendChild(el("div", "step", zy("第一步：列式")));
    choiceBlock(area, "要怎麼列式？", order.map(function (k) { return forms[k]; }), order.indexOf(0), function () {
      setTimeout(function () {
        area.innerHTML = "";
        area.appendChild(el("div", "step", zy("第二步：算出答案") + '　<b class="eqs">' + forms[0] + "</b>"));
        var nums = uniq([ans, t.per + t.groups, ans + t.per, ans - t.per]).slice(0, 3);
        var o2 = shuffle(nums);
        choiceBlock(area, t.ask, o2.map(function (n) { return n + " " + t.unit; }), o2.indexOf(ans), function () {
          area.appendChild(el("div", "why eq", t.per + " × " + t.groups + " ＝ " + ans + "　" + zy("答：") + ans + " " + zy(t.unit)));
          foot(body).appendChild(nextBtn());
        });
      }, 900);
    }, "一份有" + zhNum(t.per) + t.unit + "，有" + zhNum(t.groups) + "份，被乘數寫前面：" + t.per + " × " + t.groups + "。");
  }

  function taskOrder(t, body) {
    body.appendChild(qLine(t.q));
    var slots = el("div", "slots" + (t.items[0].label ? "" : " row"));
    t.items.forEach(function (it, k) { slots.appendChild(el("div", "slot", '<span class="n">' + (k + 1) + "</span>")); });
    body.appendChild(slots);
    var hint = el("div");
    var pieces = el("div", "pieces");
    var idx = t.items.map(function (_, k) { return k; });
    var mixed = shuffle(idx);
    if (mixed.join() === idx.join()) mixed.reverse();
    var filled = 0;
    mixed.forEach(function (k) {
      var b = el("button", "piece", zy(t.items[k].text));
      b.onclick = function () {
        if (k === filled) {
          var s = slots.children[filled];
          s.classList.add("filled");
          s.innerHTML = (t.items[k].label ? '<span class="lb">' + zy(t.items[k].label) + "</span>" : "") + zy(t.items[k].text);
          b.remove();
          filled++;
          hint.innerHTML = "";
          if (filled === t.items.length) {
            hint.appendChild(okMsg("排好了！唸唸看：" + t.items.map(function (i) { return i.text; }).join("")));
            foot(body).appendChild(nextBtn());
          }
        } else {
          b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong");
          hint.innerHTML = "";
          hint.appendChild(hintMsg(t.hint || ("第" + zhNum(filled + 1) + "格要放「" + t.items[filled].label + "」喔！")));
        }
      };
      pieces.appendChild(b);
    });
    body.appendChild(pieces);
    body.appendChild(hint);
  }

  /* --- 小遊戲：分類 --- */
  function gameSort(t, body) {
    var items = shuffle(t.items), n = 0, firstTry = 0, tries = 0;
    var bar = el("div", "bar"), fill = el("div", "fill");
    bar.appendChild(fill);
    body.appendChild(el("div", "gtitle", zy(t.title)));
    body.appendChild(bar);
    var stage = el("div", "sortStage");
    var cardEl = el("div", "sortCard" + (t.card === "envelope" ? " env" : ""));
    stage.appendChild(cardEl);
    body.appendChild(stage);
    var bins = el("div", "bins n" + t.bins.length);
    var msg = el("div");
    t.bins.forEach(function (bn, k) {
      var b = el("button", "bin", '<span class="be">' + art(bn.art) + "</span><span>" + zy(bn.name) + "</span>");
      b.onclick = function () {
        if (n >= items.length || stage.dataset.busy) return;
        var it = items[n];
        if (it.bin === k) {
          if (tries === 0) firstTry++;
          tries = 0;
          stage.dataset.busy = 1;
          cardEl.classList.add(k === 0 ? "flyL" : "flyR");
          b.classList.add("pop");
          msg.innerHTML = "";
          setTimeout(function () { b.classList.remove("pop"); delete stage.dataset.busy; n++; show(); }, 380);
        } else {
          tries++;
          cardEl.classList.remove("wrong"); void cardEl.offsetWidth; cardEl.classList.add("wrong");
          msg.innerHTML = "";
          msg.appendChild(hintMsg(tries >= 2 ? "這張要放到「" + t.bins[it.bin].name + "」喔！" : "再想想看！"));
        }
      };
      bins.appendChild(b);
    });
    body.appendChild(bins);
    body.appendChild(msg);
    function show() {
      fill.style.width = (n / items.length * 100) + "%";
      cardEl.className = "sortCard" + (t.card === "envelope" ? " env" : "");
      if (n < items.length) { cardEl.innerHTML = zy(items[n].text); return; }
      stage.style.display = "none"; bins.style.display = "none";
      var nStar = firstTry >= items.length ? 3 : firstTry >= items.length - 2 ? 2 : 1;
      body.appendChild(doneMsg("全部分類完成！", nStar));
      foot(body).appendChild(nextBtn());
      scrollEnd();
    }
    show();
  }

  /* --- 小遊戲：警察抓壞蛋 --- */
  function gameCatch(t, body) {
    var badTotal = t.items.filter(function (i) { return i.bad; }).length, found = 0;
    body.appendChild(el("div", "gtitle", zy(t.title)));
    var track = el("div", "track");
    var cop = el("span", "cop", ART.police()), thief = el("span", "thief", ART.thief(false));
    track.appendChild(cop); track.appendChild(thief);
    body.appendChild(track);
    body.appendChild(el("div", "step", zy("點一點：哪些是「不對的行為」？")));
    var grid = el("div", "cgrid");
    var msg = el("div");
    shuffle(t.items).forEach(function (it) {
      var b = el("button", "ccard", zy(it.text));
      b.onclick = function () {
        if (b.dataset.done) return;
        b.dataset.done = 1;
        msg.innerHTML = "";
        if (it.bad) {
          found++;
          b.classList.add("caught");
          b.insertAdjacentHTML("beforeend", '<span class="badge">' + ART.cuffs() + "</span>");
          msg.appendChild(okMsg(t.badNote));
          cop.style.left = (8 + 70 * found / badTotal) + "%";
          if (found === badTotal) win();
        } else {
          b.classList.add("good");
          b.insertAdjacentHTML("beforeend", '<span class="badge">' + ART.check() + "</span>");
          msg.appendChild(hintMsg(t.goodNote));
        }
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(msg);
    function win() {
      setTimeout(function () {
        thief.innerHTML = ART.thief(true);
        cop.style.left = "62%";
        msg.innerHTML = "";
        msg.appendChild(doneMsg("抓到壞蛋了！" + t.end));
        foot(body).appendChild(nextBtn());
        scrollEnd();
      }, 500);
    }
  }

  /* --- 小遊戲：看圖列式（滅火、種樹、存錢） --- */
  function gameRun(t, body) {
    var r = 0;
    var top = el("div", "runTop");
    top.appendChild(el("div", "gtitle", zy(t.title)));
    var row = el("div", "targets");
    t.rounds.forEach(function () { row.appendChild(el("span", "tg", art(t.before))); });
    top.appendChild(row);
    body.appendChild(top);
    var area = el("div", "steparea");
    body.appendChild(area);
    function round() {
      area.innerHTML = "";
      if (r >= t.rounds.length) {
        area.appendChild(doneMsg("任務完成！"));
        foot(body).appendChild(nextBtn());
        return;
      }
      var rd = t.rounds[r], ans = rd.per * rd.groups;
      var forms = mulForms(rd.per, rd.groups), order = shuffle([0, 1, 2]);
      area.appendChild(qLine("第" + zhNum(r + 1) + "題：" + rd.q));
      area.appendChild(groupPics(rd.item, rd.per, rd.groups));
      choiceBlock(area, "", order.map(function (k) { return forms[k]; }), order.indexOf(0), function () {
        var tg = row.children[r];
        tg.innerHTML = art(t.after);
        tg.classList.add("pop");
        area.appendChild(el("div", "why eq", forms[0] + " ＝ " + ans + "　" + zy("答：") + ans + " " + zy(rd.unit)));
        r++;
        setTimeout(round, 1500);
      }, "一份有" + zhNum(rd.per) + "，有" + zhNum(rd.groups) + "份，被乘數寫前面。");
    }
    round();
  }

  /* --- 小遊戲：警察追小偷（一次一件事，判斷可以／不可以） --- */
  function gameChase(t, body) {
    var GOAL = 5;            // 警察要追幾步才抓到
    var gap = GOAL;          // 警察和小偷之間還差幾步
    var queue = shuffle(t.items.map(function (_, k) { return k; }));
    var stage = el("div", "chase");
    var lane = el("div", "lane");
    var cop = el("div", "actor cop", ART.police("happy"));
    var thief = el("div", "actor thief", ART.thief("smug"));
    var say = el("div", "say");
    lane.appendChild(cop); lane.appendChild(thief); lane.appendChild(say);
    stage.appendChild(lane);
    body.appendChild(stage);
    var card = el("div", "event");
    body.appendChild(card);
    var btns = el("div", "judge");
    var bOk = el("button", "jb ok", '<span class="ji">' + ART.check() + "</span>" + zy("可以"));
    var bNo = el("button", "jb no", '<span class="ji">' + ART.cross() + "</span>" + zy("不可以"));
    btns.appendChild(bOk); btns.appendChild(bNo);
    body.appendChild(btns);
    var msgBox = el("div", "chaseMsg");
    body.appendChild(msgBox);
    var busy = false, cur_ = -1;
    function place() {
      // 小偷站在右邊；警察的位置依距離決定
      var left = 6 + (GOAL - gap) / GOAL * 58;
      cop.style.left = left + "%";
      thief.style.left = Math.min(82, left + 14 + gap * 2) + "%";
    }
    function bubble(text, who) {
      say.innerHTML = zy(text);
      say.className = "say show " + who;
      clearTimeout(say._t);
      say._t = setTimeout(function () { say.className = "say"; }, 1400);
    }
    function next() {
      busy = false;
      if (gap <= 0) return win();
      if (!queue.length) queue = shuffle(t.items.map(function (_, k) { return k; }));
      cur_ = queue.shift();
      card.innerHTML = '<div class="evLab">' + zy("看到這件事：") + "</div>";
      var q = el("div", "evText");
      q.appendChild(qLine(t.items[cur_].text));
      card.appendChild(q);
    }
    function judge(saysOk) {
      if (busy || cur_ < 0) return;
      busy = true;
      var it = t.items[cur_];
      msgBox.innerHTML = "";
      if (saysOk === it.ok) {
        gap--;
        cop.innerHTML = ART.police(gap <= 0 ? "proud" : "run");
        thief.innerHTML = ART.thief(gap <= 1 ? "worried" : "smug");
        cop.classList.remove("hop"); void cop.offsetWidth; cop.classList.add("hop");
        bubble(it.ok ? "對，可以這樣做！" : "嗶！不可以！", "c");
        msgBox.appendChild(okMsg(it.why));
      } else {
        gap = Math.min(GOAL, gap + 1);
        queue.splice(Math.min(2, queue.length), 0, cur_); // 答錯的題目，隔兩題再出一次
        thief.innerHTML = ART.thief("smug");
        cop.innerHTML = ART.police("happy");
        thief.classList.remove("hop"); void thief.offsetWidth; thief.classList.add("hop");
        bubble("嘿嘿，我溜走了！", "t");
        msgBox.appendChild(hintMsg((it.ok ? "這件事是可以的。" : "這件事是不可以的。") + it.why));
      }
      place();
      setTimeout(next, 1700);
    }
    bOk.onclick = function () { judge(true); };
    bNo.onclick = function () { judge(false); };
    function win() {
      cop.innerHTML = ART.police("proud");
      thief.innerHTML = ART.thief("caught");
      thief.style.left = "60%"; cop.style.left = "44%";
      card.style.display = "none"; btns.style.display = "none";
      msgBox.innerHTML = "";
      msgBox.appendChild(doneMsg("抓到小偷了！" + t.end));
      foot(body).appendChild(nextBtn());
    }
    place();
    next();
  }

  /* --- 地名挑戰：選出兩個 --- */
  function taskPick2(t, body) {
    body.appendChild(el("div", "gtitle", zy(t.title)));
    var combo = el("div", "combo");
    combo.innerHTML = '<span class="slotc">？</span><span class="plus">＋</span><span class="slotc">？</span><span class="plus">＝</span><span class="res">' + zy(t.result) + "</span>";
    body.appendChild(combo);
    body.appendChild(el("div", "step", zy("點兩個地名")));
    var grid = el("div", "cgrid");
    var msg = el("div");
    var got = 0;
    t.options.forEach(function (o, k) {
      var b = el("button", "ccard", zy(o));
      b.onclick = function () {
        if (b.dataset.done || got >= 2) return;
        var pos = t.answer.indexOf(k);
        msg.innerHTML = "";
        if (pos >= 0) {
          b.dataset.done = 1;
          b.classList.add("good");
          got++;
          var sl = combo.querySelectorAll(".slotc")[pos];
          sl.innerHTML = zy(t.parts[pos]);
          sl.classList.add("on");
          if (got === 2) {
            combo.querySelector(".res").classList.add("on");
            msg.appendChild(doneMsg(t.end));
            foot(body).appendChild(nextBtn());
            scrollEnd();
          }
        } else {
          b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong");
          msg.appendChild(hintMsg("再想想看！提示：一個是老地名，一個是溪的名字。"));
        }
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(msg);
  }

  function taskLetter(t, body) {
    body.appendChild(qLine(t.q));
    body.appendChild(el("div", "step", zy("第一步：你想寫給誰？")));
    var who = el("div", "who");
    t.recipients.forEach(function (r) {
      var b = el("button", "opt who1", '<span class="wi">' + (ART.icon[r.icon] || ART.icon.letter)() + "</span>" + zy(r.name));
      b.onclick = function () { pickLine(r); };
      who.appendChild(b);
    });
    body.appendChild(who);
    function pickLine(r) {
      head();
      var b2 = el("div");
      sheet.appendChild(b2);
      b2.appendChild(el("span", "tag 國語", zy("國語")));
      b2.appendChild(qLine("第二步：你想跟" + r.name + "說什麼？"));
      var o = el("div", "opts");
      r.lines.forEach(function (line) {
        var b = el("button", "opt", zy(line));
        b.onclick = function () { showLetter(r, line); };
        o.appendChild(b);
      });
      b2.appendChild(o);
    }
    function showLetter(r, line) {
      head();
      var b3 = el("div");
      sheet.appendChild(b3);
      b3.appendChild(el("span", "tag 國語", zy("國語")));
      b3.appendChild(qLine("第三步：寫上你的名字，信就完成了！"));
      var L = el("div", "letter");
      L.innerHTML =
        "<div>" + zy("親愛的" + r.name + "：") + "</div>" +
        '<div class="ind">' + zy(t.greeting + line) + "</div>" +
        '<div class="ind">' + zy(t.blessing[0]) + "</div>" +
        "<div>" + zy(t.blessing[1]) + "</div>" +
        '<div class="right"><input id="me" placeholder="你的名字" maxlength="8"> ' + zy("敬上") + "</div>" +
        '<div class="right">' + zy(zhDate()) + "</div>";
      b3.appendChild(L);
      b3.appendChild(el("div", "note", zy("名字只會顯示在這台平板上，不會上傳。完成後，照著這個格式把信抄到信紙上，還可以再多寫幾句話！")));
      foot(b3).appendChild(nextBtn("寫好了"));
    }
  }

  function finishStation() {
    var stn = ST[cur.k];
    state.done[stn.id] = true;
    closeCard();
    if (nextIndex() === -1) toast(ART.kid("cheer"), "完成社區踏查！拿到全部" + zhNum(ST.length) + "個印章！");
    else toast(ART.iconFor(stn), "拿到「" + stn.name + "」的印章！");
  }

  /* ---------- 畫面大小 ---------- */
  function onResize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 58 : 45;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", onResize);
  onResize();

  /* ---------- 主迴圈 ---------- */
  var clock = new THREE.Clock();
  var first = true;
  function loop() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var time = clock.elapsedTime;
    if (walking) {
      var step = 9 * dt;
      if (Math.abs(walkTarget - walkS) <= step) {
        walkS = walkTarget;
        walking = false;
        refresh();
        var cb = arriveCb; arriveCb = null;
        if (cb) setTimeout(cb, 250);
      } else walkS += Math.sign(walkTarget - walkS) * step;
    }
    var w = pointAt(walkS);
    kid.position.set(w.p.x, walking ? Math.abs(Math.sin(time * 12)) * 0.25 : 0, w.p.z);
    var dir = walkTarget >= walkS ? w.d : w.d.clone().negate();
    if (walking) kid.rotation.y = Math.atan2(dir.x, dir.z);
    shadow.position.set(w.p.x, 0.11, w.p.z);
    walkers.forEach(function (wk) {
      wk.t += dt * 0.06;
      var f = (Math.sin(wk.t * Math.PI * 2) + 1) / 2;
      var p = wk.a.clone().lerp(wk.b, f);
      var d = Math.cos(wk.t * Math.PI * 2) > 0 ? wk.b.clone().sub(wk.a) : wk.a.clone().sub(wk.b);
      wk.obj.position.set(p.x, Math.abs(Math.sin(time * 8 + wk.t)) * 0.12, p.z);
      wk.obj.rotation.y = Math.atan2(d.x, d.z);
    });
    var n = nextIndex();
    var sc = camMode === "overview" ? 1.5 : 0.9;
    signs.forEach(function (sg, k) {
      var bounce = (k === n && !walking) ? Math.abs(Math.sin(time * 3)) * 0.6 : 0;
      sg.sprite.position.y = sg.sprite.userData.baseY + bounce;
      sg.sprite.scale.set(6.6 * sc, 2.27 * sc, 1);
      if (ST[k].noBuilding) sg.sprite.visible = n === k || !!state.done[ST[k].id] || state.teacher;
    });
    ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    centerPick.forEach(function (cs) { var k2 = camMode === "overview" ? 1.6 : 1; cs.scale.set(6 * k2, 2.8 * k2, 1); });
    var c = desiredCam();
    var lerp = first ? 1 : 1 - Math.pow(0.02, dt);
    first = false;
    camTarget.lerp(c.tgt, lerp);
    camPos.lerp(c.pos, lerp);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  // 陰影：建築、樹、人物投影；地面接收
  scene.traverse(function (o) {
    if (!o.isMesh) return;
    var flat = o.geometry && o.geometry.type === "PlaneGeometry";
    o.receiveShadow = true;
    o.castShadow = !flat && o !== shadow && o !== ring;
  });
  shadow.visible = false;
  refresh();
  loop();
  dbOpen(function () { dbAll(function () { ST.forEach(function (_, k) { photoSprite(k); }); }); });

  window.__walk = { state: state, openStation: openStation, chooseStation: chooseStation, zy: zy, jump: function (n) { if (cur) { cur.step = n; renderTask(); } } };
})();
