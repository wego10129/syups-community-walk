/*
 * 社區踏查地圖：畫面與互動程式（精簡版）
 * 內容（路線、站點、每站要說的話）在 data/tour.js；注音在 js/zhuyin.js。
 * 只有一種用法：老師在大屏上操作。出發前看路線和約定，回到教室再走一次、看照片、討論。
 */
(function () {
  "use strict";
  var TOUR = window.TOUR;
  var ST = TOUR.stations;
  var KEY = "community-walk-v3";
  // 畫面風格數值（黏土玩具感）：亮度、三盞燈強度、材質霧面程度
  var LOOK = {
    exposure: 0.65, hemi: 0.55, sun: 0.95, fill: 0.22, rough: 0.78, fogNear: 110, fogFar: 230,
    // 色票：大面積的地面、草地、道路、溪水（色調映射會讓顏色變淡，所以這裡比較飽和）
    ground: 0x96d46e, lawn: 0x7cc75a, road: 0xf6cf8a, water: 0x4db6ea
  };

  /* ---------- 進度（只存在這台裝置的瀏覽器裡）：走過哪些站、人物停在哪一站 ---------- */
  var state = { visited: {}, at: 0, zhuyin: true };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) state = Object.assign(state, saved);
  } catch (e) {}
  if (!(state.at >= 0 && state.at < ST.length)) state.at = 0;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

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


  var ART = window.ART;
  // 站的小圖示做成圖片，畫到 3D 站牌上
  function svgImg(svgText) {
    var img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText.replace("<svg ", '<svg width="128" height="128" '));
    return img;
  }


  /* ---------- 注音 ---------- */
  var Z = window.ZHUYIN;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // 注音做法照 class-games：注音字型 CW Bpmf（js/bpmf-font.js），國字和注音是同一個字形。
  // 破音字在字後面加異體字選擇子：第 n 個讀音（從 0 起算）加 U+E01E0+n，讀音順序見 BPMF_ORDER。
  var ORDER = window.BPMF_ORDER || {};
  function zyStr(text) {
    var reads = Z.read(text), out = "";
    for (var i = 0; i < text.length; i++) {
      var c = text[i], list = ORDER[c], n = list && reads[i] ? list.indexOf(reads[i]) : -1;
      out += c + (n > 0 ? String.fromCodePoint(0xE01E0 + n) : "");
    }
    return out;
  }
  function zy(text) {
    text = String(text);
    if (!state.zhuyin) return esc(text);
    return '<span class="zyt">' + esc(zyStr(text)) + "</span>";
  }
  // 在畫布上畫有注音的文字（站牌、集點卡用）
  function zyFont(size) { return state.zhuyin ? size + "px " + ZFONT : "bold " + size + "px " + FONT; }
  function zyMeasure(ctx, text, size) {
    ctx.font = zyFont(size);
    return ctx.measureText(state.zhuyin ? zyStr(text) : text).width;
  }
  function zyDraw(ctx, text, x, y, size, color) {
    ctx.fillStyle = color || "#3b2f2a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = zyFont(size);
    ctx.fillText(state.zhuyin ? zyStr(text) : text, x, y);
  }
  var FONT = "'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif";
  var ZFONT = "'CW Bpmf'," + FONT;

  /* ---------- 照片（老師設定，存在這台裝置的 IndexedDB） ---------- */
  var photos = {}; // id -> [dataURL, ...]（一站最多三張）
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
        if (cur) { var v = cur.value; photos[cur.key] = Array.isArray(v) ? v : v ? [v] : []; cur.continue(); } else cb();
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
        var max = 1200, w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
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
  // 黏土感：顏色用 sRGB 色彩管理，再經 ACES 色調映射，亮部不會過曝
  THREE.ColorManagement.legacyMode = false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    $("err").style.display = "grid";
    window.__ok = true; // 已經用中文說明原因
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd6ecfb);
  scene.fog = new THREE.Fog(0xd6ecfb, LOOK.fogNear, LOOK.fogFar);
  var camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
  // 三盞燈：半球光（天空／地面反光）＋暖色主光（投影）＋冷色補光（讓背光面不死黑）
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xb2c08f, LOOK.hemi));
  var fill = new THREE.DirectionalLight(0xbcd4ff, LOOK.fill);
  fill.position.set(40, 30, -35);
  scene.add(fill);
  var sun = new THREE.DirectionalLight(0xfff0d8, LOOK.sun);
  sun.position.set(-30, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 4;
  scene.add(sun);

  // 站牌、照片等平面標籤：保持原本顏色，不經色調映射
  function uiSprite(tex) {
    tex.encoding = THREE.sRGBEncoding;
    return new THREE.SpriteMaterial({ map: tex, depthTest: false, toneMapped: false });
  }
  var matCache = {};
  function mat(color) {
    if (!matCache[color]) matCache[color] = new THREE.MeshStandardMaterial({ color: color, roughness: LOOK.rough, metalness: 0 });
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

  var ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(LOOK.ground));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 公園草地的範圍寫在 data/tour.js 的 park；沒有公園就不畫
  var PARK = TOUR.park || null;
  if (PARK) {
    var parkLawn = new THREE.Mesh(new THREE.PlaneGeometry(PARK.w, PARK.d), mat(LOOK.lawn));
    parkLawn.rotation.x = -Math.PI / 2;
    parkLawn.position.set(PARK.x, 0.02, PARK.z);
    scene.add(parkLawn);
  }

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

  var roadMat = mat(LOOK.road);
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
    if (!leafCache[color]) leafCache[color] = new THREE.MeshStandardMaterial({ color: color, flatShading: true, roughness: LOOK.rough, metalness: 0 });
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
    c.fillText(ST[0].name.split("").join(" "), 512, 120);
    c.fillStyle = "#c9c4bb"; c.fillRect(420, 380, 184, 132);
    c.fillStyle = "#4a3b33"; c.fillRect(440, 400, 144, 112);
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // 四坡屋頂（廟的屋頂）：底部在 y，寬 w、深 d、高 h
  function hipRoof(w, d, h, color, y, parent, x, z) {
    var m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(color));
    m.rotation.y = Math.PI / 4;
    var geo = m.geometry.clone(); geo.rotateY(Math.PI / 4); m.geometry = geo; m.rotation.y = 0;
    m.scale.set(w / Math.SQRT2, h, d / Math.SQRT2);
    m.position.set(x || 0, y + h / 2, z || 0);
    (parent || scene).add(m);
    return m;
  }
  // 招牌、匾額：用 canvas 寫字做成貼圖（不加注音，照真實招牌的樣子）
  function signMesh(text, w, h, o) {
    var cv = document.createElement("canvas"), S = 128;
    cv.width = Math.round(w * S); cv.height = Math.round(h * S);
    var c = cv.getContext("2d");
    c.fillStyle = o.bg; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = o.fg; c.textAlign = "center"; c.textBaseline = "middle";
    if (o.vertical) {
      var fs = Math.min(cv.width * 0.75, cv.height / (text.length + 0.6));
      c.font = "bold " + fs + "px " + FONT;
      for (var i = 0; i < text.length; i++) c.fillText(text[i], cv.width / 2, (i + 0.8) * cv.height / (text.length + 0.6));
    } else {
      c.font = "bold " + Math.min(cv.height * 0.7, cv.width / (text.length + 0.4)) + "px " + FONT;
      c.fillText(text.split("").join(" "), cv.width / 2, cv.height / 2);
    }
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: LOOK.rough, metalness: 0 }));
  }

  // canvas 畫成貼圖（facade、招牌、徽章共用）
  function canvasTex(w, h, draw) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function texMat(t) { return new THREE.MeshStandardMaterial({ map: t, roughness: LOOK.rough, metalness: 0 }); }
  // 有貼圖正面的方塊：面的順序是 右、左、上、下、前、後
  function faceBox(w, h, d, faces, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    parent.add(m);
    return m;
  }
  // 行道樹（榕樹）：粗樹幹、扁扁的大樹冠。不用亂數，才不會讓地圖上其他樹換位置
  function banyan(x, z, sc, parent) {
    var g = new THREE.Group();
    cyl(0.24 * sc, 0.36 * sc, 1.7 * sc, 0x7a6a58, 0, 0, 0, g, 7);
    [[0, 2.5, 0, 1.25, 0x4f8f4a], [0.95, 2.15, 0.25, 0.95, 0x5c9c55], [-0.85, 2.25, -0.2, 0.95, 0x5aa35f], [0.15, 2.2, 0.85, 0.85, 0x6cb565]].forEach(function (c) {
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(c[3] * sc, 0), leafMat(c[4]));
      m.scale.y = 0.75;
      m.rotation.y = c[0] * 2 + c[2];
      m.position.set(c[0] * sc, c[1] * sc, c[2] * sc);
      g.add(m);
    });
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }
  function wheel(r, x, y, z, parent) {
    var w = cyl(r, r, 0.16, 0x2b2b2b, 0, 0, 0, parent, 14);
    w.position.set(x, y, z);
    w.rotation.x = Math.PI / 2;
    return w;
  }
  // 機車：車身沿著 z 方向（車頭朝 +z）
  function scooter(color, x, z, rot, parent) {
    var g = new THREE.Group();
    box(0.3, 0.3, 1.0, color, 0, 0.18, 0, g);
    box(0.32, 0.12, 0.5, 0x2b2b2b, 0, 0.48, -0.2, g); // 座墊
    box(0.3, 0.55, 0.14, color, 0, 0.18, 0.42, g); // 前擋
    box(0.6, 0.05, 0.05, 0x444444, 0, 0.78, 0.45, g); // 把手
    [-0.38, 0.4].forEach(function (wz) { var w = wheel(0.17, 0, 0.17, wz, g); w.rotation.set(0, 0, Math.PI / 2); });
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    parent.add(g);
    return g;
  }
  // 警車：白色車身、深藍色腰線、車頂紅藍警示燈（車身沿著 x 方向）
  function patrolCar(x, z, rot, parent) {
    var g = new THREE.Group();
    box(2.0, 0.5, 0.95, 0xf4f6f8, 0, 0.18, 0, g);
    box(2.02, 0.16, 0.97, 0x23407a, 0, 0.3, 0, g); // 深藍腰線
    box(0.55, 0.06, 0.9, 0x23407a, 0.72, 0.66, 0, g); // 引擎蓋上的藍色
    box(1.15, 0.42, 0.85, 0x3f4f5e, -0.15, 0.66, 0, g); // 車窗
    box(1.1, 0.06, 0.82, 0xf4f6f8, -0.15, 1.08, 0, g); // 車頂
    box(0.22, 0.12, 0.3, 0xe2382b, -0.15, 1.14, -0.17, g); // 警示燈
    box(0.22, 0.12, 0.3, 0x2f6fe0, -0.15, 1.14, 0.17, g);
    [[-0.65, -0.45], [-0.65, 0.45], [0.65, -0.45], [0.65, 0.45]].forEach(function (p) { wheel(0.2, p[0], 0.2, p[1], g); });
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    parent.add(g);
    return g;
  }
  // 郵筒：長方形筒身、圓弧頂、投信口（臺灣的郵筒：綠色寄平信、紅色寄限時和航空）
  function mailbox(color, x, z, parent) {
    box(0.46, 0.22, 0.4, 0x5a5f63, x, 0, z, parent);
    box(0.62, 0.8, 0.5, color, x, 0.22, z, parent);
    var top = cyl(0.25, 0.25, 0.62, color, x, 0.77, z, parent, 16);
    top.rotation.z = Math.PI / 2;
    box(0.36, 0.05, 0.03, 0x1e1e1e, x, 0.84, z + 0.26, parent); // 投信口
    box(0.36, 0.2, 0.02, 0xffffff, x, 0.5, z + 0.26, parent); // 白色標示
  }
  // 中華郵政的招牌：綠底、左邊紅色郵徽、白字「郵局 POST」、右邊紅白藍斜條
  function postSignTex() {
    return canvasTex(1024, 112, function (c, W, H) {
      c.fillStyle = "#13a04b"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(70, 56, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#d8262b"; c.beginPath(); c.arc(70, 56, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff";
      c.fillRect(48, 36, 44, 7); c.fillRect(48, 52, 44, 7); c.fillRect(48, 68, 44, 7); c.fillRect(66, 28, 8, 56);
      c.textBaseline = "middle"; c.textAlign = "left";
      c.font = "bold 76px " + FONT; c.fillText("郵 局", 130, 60);
      c.font = "bold 70px " + FONT; c.fillText("POST", 470, 60);
      [["#d8262b", 0], ["#ffffff", 26], ["#2b2f6b", 52]].forEach(function (b) {
        c.fillStyle = b[0]; c.beginPath();
        c.moveTo(860 + b[1], H); c.lineTo(930 + b[1], 0); c.lineTo(952 + b[1], 0); c.lineTo(882 + b[1], H); c.fill();
      });
    });
  }
  // 郵局樓上的立面：米色磁磚、每層三扇窗、白色鐵窗
  function postFacadeTex() {
    return canvasTex(640, 330, function (c, W, H) {
      c.fillStyle = "#d9cbb0"; c.fillRect(0, 0, W, H);
      for (var f = 0; f < 3; f++) {
        var y = 74 + f * 86;
        c.fillStyle = "#c2b293"; c.fillRect(0, y + 74, W, 8);
        [30, 240, 450].forEach(function (x) {
          c.fillStyle = "#6b6f72"; c.fillRect(x, y + 8, 160, 58);
          c.fillStyle = "#86a0ae"; c.fillRect(x + 5, y + 13, 150, 48);
          c.fillStyle = "#eeeeea";
          for (var b = x + 5; b < x + 160; b += 15) c.fillRect(b, y + 8, 3, 58);
          c.fillRect(x, y + 34, 160, 3);
        });
      }
    });
  }
  // 派出所的立面：淺灰色格子框、紅色牆板、白框深色窗、窗下的冷氣
  function policeFacadeTex(cols, cross) {
    var CW = 130, RH = 90;
    return canvasTex(cols * CW, 4 * RH, function (c, W, H) {
      c.fillStyle = "#d2cfc9"; c.fillRect(0, 0, W, H);
      for (var r = 0; r < 4; r++) for (var k = 0; k < cols; k++) {
        var x = k * CW + 9, y = r * RH + 8, w = CW - 18, h = RH - 16;
        c.fillStyle = "#b4473c"; c.fillRect(x, y, w, h);
        if (cross && r === 3 && k === 1) {
          // 二樓那一格的木頭 X 裝飾
          c.fillStyle = "#e4d4b6"; c.fillRect(x, y, w, h);
          c.strokeStyle = "#8a5a3c"; c.lineWidth = 12;
          c.strokeRect(x + 6, y + 6, w - 12, h - 12);
          c.beginPath(); c.moveTo(x + 8, y + 8); c.lineTo(x + w - 8, y + h - 8); c.moveTo(x + w - 8, y + 8); c.lineTo(x + 8, y + h - 8); c.stroke();
          continue;
        }
        c.fillStyle = "#f2f2ee"; c.fillRect(x + 14, y + 6, w - 28, h - 30);
        c.fillStyle = "#566573"; c.fillRect(x + 19, y + 11, w - 38, h - 40);
        c.fillStyle = "#f2f2ee"; c.fillRect(x + w / 2 - 2, y + 11, 4, h - 40);
        c.fillStyle = "#e9e9e4"; c.fillRect(x + w - 48, y + h - 21, 34, 18); // 冷氣
        c.fillStyle = "#b9b9b3"; c.fillRect(x + w - 44, y + h - 17, 26, 3);
      }
    });
  }
  // 派出所的圓形徽章招牌
  function policeBadgeTex() {
    return canvasTex(256, 256, function (c) {
      [["#263f7d", 124], ["#ffffff", 104], ["#c8372d", 90], ["#263f7d", 58]].forEach(function (r) {
        c.fillStyle = r[0]; c.beginPath(); c.arc(128, 128, r[1], 0, Math.PI * 2); c.fill();
      });
      c.fillStyle = "#f2c14e";
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5 - Math.PI / 2;
        c.beginPath(); c.arc(128 + Math.cos(a) * 24, 128 + Math.sin(a) * 24, 17, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(128, 128, 12, 0, Math.PI * 2); c.fill();
    });
  }

  var BUILD = {
    // 三玉國小：依空拍圖配置（南邊是校門，往北依序是前棟、長廊棟、中庭、操場）
    school: function (g) {
      // 前棟（紅磚色、四層樓，正面用畫的窗戶與校名）
      var face = facadeTexture();
      var side = mat(0x7a2e2e);
      var front = new THREE.Mesh(new THREE.BoxGeometry(11, 5.4, 3), [side, side, mat(0xe9e4dc), side, new THREE.MeshStandardMaterial({ map: face, roughness: LOOK.rough, metalness: 0 }), side]);
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
    // 三玉宮：照實景照片（2026-11 使用者提供）。
    // 認得出來的特徵：橘紅瓦屋頂＋屋脊上彩色的龍和剪黏、左右兩座多層的鐘鼓樓、紅柱、黑底金字的「三玉宮」匾、
    // 金色香爐、前面灰藍色的石欄杆、黃色旗子
    temple: function (g) {
      var RED = 0xc23a2e, TILE = 0xd8643c, GOLD = 0xe8b83a, GREEN = 0x2f9a7a, BLUE = 0x3a86c8, STONE = 0x9aa5b1;
      box(7.4, 0.4, 5.8, 0xcfc8bc, 0, 0, -0.2, g); // 石台
      // 正殿
      box(4.6, 2.1, 2.8, RED, 0, 0.4, -0.8, g);
      box(4.4, 1.5, 0.1, 0x7a2a22, 0, 0.5, 0.62, g); // 門
      // 正殿屋頂：橘紅瓦的四坡屋頂，四個角往上翹
      hipRoof(5.6, 3.8, 1.2, TILE, 2.5, g, 0, -0.8);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) {
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 6), mat(TILE));
        tip.position.set(c[0] * 2.75, 2.75, -0.8 + c[1] * 1.8);
        tip.rotation.z = c[0] * -0.75; tip.rotation.x = c[1] * 0.75;
        g.add(tip);
      });
      // 屋脊：金色脊＋彩色剪黏＋兩條龍（彎彎的綠色身體）＋中間的寶塔
      box(3.4, 0.2, 0.3, GOLD, 0, 3.45, -0.8, g);
      for (var i = -3; i <= 3; i++) ball(0.16, [GREEN, BLUE, GOLD, 0xe2553a][(i + 8) % 4], i * 0.5, 3.8, -0.8, g);
      [-1, 1].forEach(function (sx) {
        var dragon = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.13, 8, 16, Math.PI * 1.2), mat(GREEN));
        dragon.position.set(sx * 1.25, 3.85, -0.8); dragon.rotation.z = sx > 0 ? 0.3 : Math.PI - 1.2 + 0.3; g.add(dragon);
        ball(0.2, GOLD, sx * 1.85, 4.0, -0.8, g); // 龍頭
      });
      cyl(0.08, 0.3, 0.7, GOLD, 0, 3.6, -0.8, g, 8);
      ball(0.18, 0xe2553a, 0, 4.4, -0.8, g);
      // 前殿（三川門）：紅柱、小屋頂、黑底金字匾額
      [-1.7, -0.6, 0.6, 1.7].forEach(function (x) { cyl(0.16, 0.16, 2.0, Math.abs(x) < 1 ? 0x6e7680 : RED, x, 0.4, 1.3, g, 10); }); // 中間兩根是石雕龍柱
      hipRoof(4.8, 2.0, 0.6, TILE, 2.4, g, 0, 1.2);
      box(2.6, 0.16, 0.16, GOLD, 0, 2.86, 1.2, g);
      var plaque = signMesh("三玉宮", 1.9, 0.5, { bg: "#1e1a18", fg: "#f2c14e" });
      plaque.position.set(0, 2.05, 1.95); g.add(plaque);
      ball(0.22, 0xe2382b, -1.15, 2.0, 1.9, g); // 紅燈籠
      ball(0.22, 0xe2382b, 1.15, 2.0, 1.9, g);
      // 左右鐘鼓樓：灰色塔身＋三層綠金色屋頂
      [-1, 1].forEach(function (sx) {
        var x = sx * 3.0;
        box(1.4, 3.0, 1.4, 0xb7b0a6, x, 0.4, -0.6, g);
        box(1.0, 0.5, 0.1, RED, x, 1.4, 0.12, g);
        for (var t = 0; t < 3; t++) {
          var y = 3.4 + t * 0.85, r = 1.25 - t * 0.25;
          pyramid(r, 0.55, t % 2 ? GOLD : GREEN, y, g, x, -0.6);
          box(r * 1.15, 0.3, r * 1.15, RED, x, y - 0.3, -0.6, g);
        }
        ball(0.2, GOLD, x, 6.15, -0.6, g);
      });
      // 金色香爐
      cyl(0.45, 0.35, 0.55, GOLD, 0, 0.4, 2.0, g, 10);
      cyl(0.12, 0.25, 0.5, GOLD, 0, 0.95, 2.0, g, 8);
      // 灰藍色石欄杆（中間留出入口）＋黃色旗子
      [-1, 1].forEach(function (sx) {
        box(2.5, 0.65, 0.22, STONE, sx * 2.35, 0.4, 2.65, g);
        for (var q = 0; q < 4; q++) box(0.26, 0.85, 0.26, 0xb9c1ca, sx * (1.2 + q * 0.75), 0.4, 2.65, g);
        cyl(0.04, 0.04, 2.0, 0x8a6142, sx * 1.4, 0.4, 2.9, g, 6);
        box(0.05, 0.75, 0.5, 0xf2c94c, sx * 1.4, 1.6, 3.15, g);
      });
    },
    // 臺灣銀行天母分行：照實景照片（2026-11 使用者提供）。
    // 認得出來的特徵：粉紅色石材的四層大樓、深色橫向窗帶、右後方較高的塔樓（上面有圓形行徽）、
    // 轉角的直立招牌（白底紅字「臺灣銀行」）、門口低矮的雨遮、綠色樹籬
    bank: function (g) {
      var PINK = 0xe2bfb2, PINK2 = 0xd3aa9c, WIN = 0x4a3c36;
      box(6.6, 0.3, 4.8, 0xc9b8ae, 0, 0, 0, g); // 人行道與台階
      box(6.0, 4.4, 3.6, PINK, 0, 0.3, -0.3, g); // 主樓
      for (var f = 0; f < 3; f++) {
        var y = 1.75 + f * 0.95;
        box(5.6, 0.5, 0.1, WIN, 0, y, 1.52, g); // 正面窗帶
        box(0.1, 0.5, 3.0, WIN, 3.02, y, -0.3, g); // 側面窗帶
        box(0.1, 0.5, 3.0, WIN, -3.02, y, -0.3, g);
      }
      box(6.2, 0.25, 3.8, PINK2, 0, 4.7, -0.3, g); // 屋頂邊
      // 右後方的塔樓＋圓形行徽
      box(1.7, 6.0, 1.7, PINK, 2.0, 0.3, -1.0, g);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) box(0.3, 0.32, 0.06, WIN, 1.5 + c * 0.5, 5.2 + r * 0.5, -0.12, g);
      cyl(0.42, 0.42, 0.08, 0xb98a7c, 2.0, 0, 0, g, 20).position.set(2.0, 4.3, -0.13);
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      // 一樓：門口雨遮、深色大門、刻字
      box(3.4, 0.35, 1.2, PINK2, -0.6, 1.5, 1.9, g);
      box(0.3, 1.2, 0.3, PINK2, -2.1, 0.3, 2.3, g);
      box(0.3, 1.2, 0.3, PINK2, 0.9, 0.3, 2.3, g);
      box(2.6, 1.1, 0.1, WIN, -0.6, 0.3, 1.52, g);
      var carved = signMesh("臺灣銀行", 1.8, 0.28, { bg: "#d3aa9c", fg: "#8a5a4c" });
      carved.position.set(-0.6, 1.68, 2.51); g.add(carved);
      // 轉角的直立招牌：白底紅字
      box(0.2, 2.6, 0.2, 0xdedede, -3.0, 0.3, 2.1, g);
      var vsign = signMesh("臺灣銀行", 0.62, 2.1, { bg: "#ffffff", fg: "#c0392b", vertical: true });
      vsign.position.set(-3.0, 2.0, 2.22); g.add(vsign);
      // 提款機（「找找看」要找的東西）
      box(0.8, 1.4, 0.5, 0x8c9aa6, 2.3, 0.3, 1.75, g);
      box(0.55, 0.38, 0.05, 0x9fd3ef, 2.3, 1.15, 2.02, g);
      // 綠色樹籬和小樹
      box(1.6, 0.5, 0.6, 0x4f9a55, 1.2, 0.3, 2.9, g);
      box(1.4, 0.5, 0.6, 0x4f9a55, -1.9, 0.3, 2.9, g);
      tree(3.0, 2.4, 0.6, g);
    },
    // 天母郵局（中山北路七段 130 號）：照實景照片（2026-11 使用者提供）。
    // 認得出來的特徵：米色老公寓的一樓、綠色「郵局 POST」長招牌（左邊紅色郵徽、右邊紅白藍斜條）、
    // 深褐色磁磚的騎樓柱子、玻璃門和提款機、門口一綠一紅兩個郵筒、樓上的白色鐵窗和冷氣、行道樹和機車
    post: function (g) {
      var BEIGE = 0xd9cbb0, PILLAR = 0x6e3b33;
      box(7.6, 0.2, 5.4, 0xc9c6bf, 0, 0, 0.2, g); // 騎樓和人行道
      // 一樓店面（往內縮，前面是騎樓）
      box(6.2, 1.3, 2.4, 0xe9e6df, 0, 0.2, -1.2, g);
      box(3.4, 1.05, 0.06, 0x9fc6de, 0.6, 0.2, 0.02, g); // 玻璃門窗
      box(0.06, 1.05, 0.08, 0xd9d9d9, 0.6, 0.2, 0.06, g);
      box(0.75, 1.1, 0.25, 0xd9dcdf, -1.75, 0.2, 0.1, g); // 提款機
      box(0.75, 0.18, 0.27, 0x13a04b, -1.75, 1.12, 0.1, g);
      box(0.45, 0.3, 0.04, 0x2f4858, -1.75, 0.72, 0.24, g);
      // 樓上（伸出來蓋住騎樓）
      var side = mat(BEIGE);
      faceBox(6.4, 3.3, 3.4, [side, side, mat(0xcfc3aa), mat(0xe4ddd0), texMat(postFacadeTex()), side], 0, 1.5, -0.6, g);
      box(6.5, 0.22, 3.5, 0xc2b293, 0, 4.8, -0.6, g); // 女兒牆
      box(1.3, 0.6, 1.0, 0xcfc3aa, -1.8, 5.0, -1.2, g); // 樓梯間
      cyl(0.32, 0.32, 0.5, 0x8fa3b0, 1.6, 5.0, -1.4, g, 12); // 水塔
      [[-2.2, 2.35], [1.0, 3.2], [2.3, 4.05]].forEach(function (p) { box(0.5, 0.3, 0.25, 0xeeeeea, p[0], p[1], 1.25, g); });
      // 騎樓柱子
      [-2.95, 0, 2.95].forEach(function (x) { box(0.42, 1.5, 0.42, PILLAR, x, 0.2, 0.85, g); });
      // 綠色長招牌
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.7), texMat(postSignTex()));
      sign.position.set(0, 2.05, 1.12); g.add(sign);
      box(6.4, 0.06, 0.12, 0xf2f2ee, 0, 2.4, 1.08, g);
      // 門口的郵筒（「找找看」要找的東西）
      mailbox(0x2e9a4f, 0.55, 2.4, g);
      mailbox(0xd8392b, 1.4, 2.4, g);
      // 機車和行道樹
      scooter(0x3b4a6b, -2.3, 2.2, 0, g);
      scooter(0xe9e6df, -1.4, 2.2, 0.1, g);
      banyan(-3.7, 2.5, 0.85, g);
      banyan(4.1, 2.5, 0.85, g);
    },
    // 天母派出所（中山北路七段，路口轉角）：照實景照片（2026-11 使用者提供）。
    // 認得出來的特徵：五層樓、淺灰色格子框配紅色牆板、二樓一格木頭 X 裝飾、圓形警察徽章招牌、
    // 門口上方的金色老鷹警徽、藍框玻璃門和台階、門口停著警車和警用機車、灰色矮牆、旁邊的大榕樹
    police: function (g) {
      var Z = -0.9; // 房子往後退一點，前面才停得下警車
      // 一樓：灰色石材
      box(5.0, 1.4, 3.8, 0xb9b6b0, 0, 0, Z, g);
      box(1.5, 1.0, 0.06, 0x3a4650, 0.7, 0.2, Z + 1.92, g); // 玻璃門
      box(0.18, 1.3, 0.12, 0x2f5fa8, -0.15, 0, Z + 1.94, g); // 藍色門框
      box(0.18, 1.3, 0.12, 0x2f5fa8, 1.55, 0, Z + 1.94, g);
      box(1.9, 0.18, 0.35, 0x4a3a32, 0.7, 1.22, Z + 2.0, g); // 門上的深色雨遮
      box(2.0, 0.1, 0.5, 0xc9c6bf, 0.7, 0, Z + 2.15, g); // 台階
      box(2.0, 0.1, 0.3, 0xc9c6bf, 0.7, 0.1, Z + 2.05, g);
      box(1.2, 0.8, 0.06, 0x8a97a3, -1.6, 0.4, Z + 1.92, g); // 左邊窗戶
      // 二樓到五樓：灰框紅牆
      var front = texMat(policeFacadeTex(4, true)), sideT = texMat(policeFacadeTex(3, false));
      faceBox(5.2, 3.6, 4.0, [sideT, sideT, mat(0xc9c6c0), mat(0xc9c6c0), front, sideT], 0, 1.4, Z, g);
      box(5.3, 0.2, 4.1, 0xc9c6c0, 0, 5.0, Z, g); // 女兒牆
      box(1.4, 0.7, 1.2, 0xd2cfc9, -1.2, 5.2, Z - 0.6, g); // 樓梯間
      cyl(0.03, 0.03, 1.4, 0x777777, 1.6, 5.2, Z - 0.8, g, 5); // 天線
      box(0.7, 0.04, 0.04, 0x777777, 1.6, 6.2, Z - 0.8, g);
      // 金色老鷹警徽
      ball(0.16, 0xe8b83a, 0.7, 1.62, Z + 2.04, g);
      [-1, 1].forEach(function (sx) {
        var wing = box(0.42, 0.14, 0.05, 0xe8b83a, 0.7 + sx * 0.28, 1.58, Z + 2.03, g);
        wing.rotation.z = sx * 0.35;
      });
      // 圓形徽章招牌（掛在右邊轉角）
      var badge = new THREE.Mesh(new THREE.CircleGeometry(0.45, 28), texMat(policeBadgeTex()));
      badge.position.set(2.1, 2.0, Z + 2.12); g.add(badge);
      box(0.1, 0.5, 0.08, 0x666666, 2.1, 2.0, Z + 2.04, g);
      // 灰色矮牆、警車、警用機車、大榕樹
      box(2.0, 0.55, 0.18, 0xa9a8a3, -1.6, 0, Z + 2.35, g);
      patrolCar(-1.4, 2.0, 0, g);
      scooter(0xf4f6f8, 2.0, 1.6, 0, g);
      banyan(3.7, -1.6, 1.15, g);
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
    var sp = new THREE.Sprite(uiSprite(tex));
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
    var url = (photos[ST[k].id] || [])[0];
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
      var sp = new THREE.Sprite(uiSprite(new THREE.CanvasTexture(cv)));
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

  var ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  scene.add(ring);

  /* ---------- 玉潮坑溪 ---------- */
  var rpts = (TOUR.river || []).map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  var waterMat = new THREE.MeshStandardMaterial({ color: LOOK.water, roughness: 0.5, metalness: 0 });
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
    var csp = new THREE.Sprite(uiSprite(ctex));
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
  for (i = 0; PARK && parkIdx >= 0 && i < 24; i++) {
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
      if (PARK && Math.abs(x - PARK.x) < PARK.w / 2 + 2 && Math.abs(z - PARK.z) < PARK.d / 2 + 2) continue;
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
  // 背影小隊：老師走在最前面，後面跟著戴小黃帽、背書包的小朋友（照片只拍背影，地圖上也用背影）
  // kid 是隊伍的位置（鏡頭跟著它），其他人沿著路線排在前後
  var kid = person(0x4a7fc1, 0xf6c445);
  box(0.5, 0.6, 0.25, 0xe8704a, 0, 0.55, -0.38, kid);
  var squad = [];
  function teacherPerson() {
    var t = person(0x2f8a6d, null);
    t.scale.setScalar(1.3);
    box(0.08, 0.5, 0.35, 0xf2c94c, 0.42, 0.5, 0, t); // 手上的小旗子桿
    box(0.04, 0.35, 0.5, 0xe8704a, 0.42, 1.05, 0.25, t);
    return t;
  }
  [[1.3, 0, "teacher"], [-0.9, 0.38, 0xd8473a, 0x4a7fc1], [-0.9, -0.38, 0xf0a030, 0x3f9b5f], [-1.8, 0.38, 0x9a6fc1, 0xe8704a], [-1.8, -0.38, 0x3f9b5f, 0xd8473a]]
    .forEach(function (m) {
      var p;
      if (m[2] === "teacher") p = teacherPerson();
      else { p = person(m[2], 0xf6c445); box(0.5, 0.6, 0.25, m[3], 0, 0.55, -0.38, p); }
      squad.push({ obj: p, back: m[0], side: m[1], ph: Math.random() * 6 });
    });
  var squadDir = 1;
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
  function nextIndex() { return state.at + 1 < ST.length ? state.at + 1 : -1; }
  function stationStatus(k) {
    if (k === state.at && !walking) return "here";
    if (state.visited[ST[k].id]) return "done";
    return "next";
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
  function cardOpen() { return $("card").classList.contains("show"); }
  function desiredCam() {
    var tgt, d = dist;
    if (camMode === "overview") { tgt = new THREE.Vector3(-2, 0, 0); d = 82; }
    else if (cardOpen() && !walking) {
      // 打開卡片時，鏡頭拉近到這一站的建築（照片在右邊，3D 在左邊，方便對照）
      var s = ST[state.at];
      tgt = new THREE.Vector3((s.pos[0] + kid.position.x) / 2, 2, (s.pos[1] + kid.position.z) / 2);
      d = Math.min(dist, 24);
    } else tgt = kid.position.clone();
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
    if (k === 0 && state.at >= ST.length - 2) k = ST.length - 1;
    chooseStation(k);
  }
  // 點站牌或上方的地點：下一站就走過去，其他站直接跳過去
  function chooseStation(k) {
    if (tour.on) stopTour();
    if (walking) return;
    if (k === state.at) { openStation(k); return; }
    if (k === nextIndex()) walkTo(k, function () { openStation(k); });
    else teleport(k, function () { openStation(k); });
  }
  var poofT = 0;
  function poof() { if (!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) poofT = 0.45; }
  function teleport(k, cb) {
    closeMenu();
    if (cardOpen()) closeCard();
    state.at = k;
    walkS = walkTarget = cum[ST[k].at];
    camMode = "follow";
    $("viewBtn").classList.remove("on");
    refresh();
    poof();
    setTimeout(cb, 380);
  }

  /* ---------- 介面 ---------- */
  var stampBox = $("stamps");
  ST.forEach(function (stn, k) {
    var s = el("button", "stamp", ART.iconFor(stn));
    s.title = stn.name;
    s.setAttribute("aria-label", stn.name);
    s.onclick = function () { chooseStation(k); };
    stampBox.appendChild(s);
  });
  $("titleText").innerHTML = zy(TOUR.title);
  $("subText").textContent = TOUR.subtitle || "";

  function refresh() {
    ST.forEach(function (stn, k) {
      stampBox.children[k].classList.toggle("done", !!state.visited[stn.id]);
      stampBox.children[k].classList.toggle("here", k === state.at && !walking);
      drawSign(k);
    });
    drawCenter();
    var go = $("goBtn"), n = nextIndex();
    go.disabled = walking;
    var label;
    if (walking) label = "走路中…";
    else if (!state.visited[ST[state.at].id]) label = "看看這一站：" + ST[state.at].name;
    else if (n === -1) label = "走完了！做家長分享圖";
    else label = "▶ 走到下一站：" + ST[n].name;
    go.innerHTML = zy(label);
    var ns = n === -1 ? null : ST[n];
    ring.visible = !!ns && !walking;
    if (ns) ring.position.set(pts[ns.at].x, 0.12, pts[ns.at].z);
    $("zyBtn").textContent = state.zhuyin ? "ㄅ 注音：開（按一下關閉）" : "ㄅ 注音：關（按一下打開）";
    save();
  }
  $("goBtn").onclick = function () {
    if (tour.on) stopTour();
    if (walking) return;
    var n = nextIndex();
    if (!state.visited[ST[state.at].id]) openStation(state.at);
    else if (n === -1) openShare();
    else chooseStation(n);
  };
  $("viewBtn").onclick = function () {
    if (cardOpen()) closeCard();
    camMode = camMode === "overview" ? "follow" : "overview";
    $("viewBtn").classList.toggle("on", camMode === "overview");
  };
  $("menuBtn").onclick = function () { $("menu").classList.toggle("show"); };
  function closeMenu() { $("menu").classList.remove("show"); }
  $("zyBtn").onclick = function () { state.zhuyin = !state.zhuyin; refresh(); if (cardOpen()) openStation(state.at); };
  $("shareMenuBtn").onclick = function () { closeMenu(); openShare(); };
  var resetArm = 0;
  $("resetBtn").onclick = function () {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $("resetBtn").textContent = "再按一次就清除（照片會留著）"; return; }
    state.visited = {};
    resetArm = 0;
    $("resetBtn").textContent = "🔄 從頭開始（清除走過的紀錄）";
    closeMenu();
    teleport(0, function () {});
  };
  var toastTimer = 0;
  function toast(icon, text) {
    var t = $("toast");
    t.innerHTML = '<span class="big">' + icon + "</span><div>" + zy(text) + "</div>";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- 照片：在卡片上直接放 ---------- */
  var MAXP = 3;
  function addPhotos(k, files) {
    var id = ST[k].id, list = (photos[id] || []).slice(), todo = Array.prototype.slice.call(files, 0, MAXP - list.length);
    if (!todo.length) { toast(ART.think(), "一站最多放三張照片。"); return; }
    var left = todo.length;
    todo.forEach(function (f) {
      resizeImage(f, function (url) {
        if (url) list.push(url);
        if (--left === 0) {
          photos[id] = list; dbPut(id, list); photoSprite(k);
          if (cardOpen() && state.at === k) openStation(k);
        }
      });
    });
  }
  function removePhoto(k, i) {
    var id = ST[k].id, list = (photos[id] || []).slice();
    list.splice(i, 1);
    photos[id] = list; dbPut(id, list.length ? list : null); photoSprite(k);
    openStation(k);
  }
  function pickFiles(k) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.onchange = function () { if (inp.files && inp.files.length) addPhotos(k, inp.files); };
    inp.click();
  }

  /* ---------- 自繪小圖示（手冊：給大人看的頁面不用 emoji） ---------- */
  function ic(body) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#1B2836" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>"; }
  var ICON = {
    camera: ic('<rect x="3" y="7" width="18" height="13" rx="3" fill="#FEF3C7"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5" fill="#fff"/>'),
    look: ic('<circle cx="10.5" cy="10.5" r="6" fill="#fff"/><path d="M15 15l5 5"/>'),
    talk: ic('<path d="M4 5h16v11H10l-4 4v-4H4z" fill="#fff"/>'),
    star: ic('<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z" fill="#FACC15"/>'),
    gear: ic('<circle cx="12" cy="12" r="3.2" fill="#fff"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>')
  };
  $("menuBtn").innerHTML = ICON.gear;
  $("viewBtn").innerHTML = ART.map();

  /* ---------- 地點卡：照片在右邊，3D 在左邊 ---------- */
  var card = $("card"), sheet = $("sheet"), showIdx = 0;
  function openStation(k) {
    closeMenu();
    if (state.at !== k) state.at = k;
    state.visited[ST[k].id] = true;
    var stn = ST[k], list = photos[stn.id] || [], say = [stn.name];
    if (showIdx >= list.length) showIdx = 0;
    sheet.innerHTML = "";
    var head = el("div", "head", '<span class="hi">' + ART.iconFor(stn) + "</span><h2>" + zy(stn.name) + "</h2>");
    var x = el("button", "x", "✕"); x.setAttribute("aria-label", "關閉"); x.onclick = function () { if (tour.on) stopTour(); else closeCard(); };
    head.appendChild(x);
    sheet.appendChild(head);

    // 照片
    var ph = el("div", "photos");
    if (tour.on && !list.length) { /* 導覽中：沒有照片就不顯示放照片的框 */ }
    else if (list.length) {
      var big = el("div", "bigPhoto");
      big.style.backgroundImage = "url(" + list[showIdx] + ")";
      ph.appendChild(big);
      var row = el("div", "thumbs");
      list.forEach(function (url, i) {
        var th = el("button", "th" + (i === showIdx ? " on" : ""));
        th.style.backgroundImage = "url(" + url + ")";
        th.onclick = function () { showIdx = i; openStation(k); };
        var rm = el("span", "rm", "✕"); rm.title = "拿掉這張";
        rm.onclick = function (e) { e.stopPropagation(); if (confirm("要拿掉這張照片嗎？")) removePhoto(k, i); };
        th.appendChild(rm);
        row.appendChild(th);
      });
      if (list.length < MAXP) { var add = el("button", "th add", "＋"); add.title = "再放一張"; add.onclick = function () { pickFiles(k); }; row.appendChild(add); }
      ph.appendChild(row);
    } else {
      var empty = el("button", "emptyPhoto", '<span class="ei">' + ICON.camera + "</span><span>" + zy("放照片") + "</span><small>點這裡，從相簿選照片（最多三張）</small>");
      empty.onclick = function () { pickFiles(k); };
      ph.appendChild(empty);
    }
    sheet.appendChild(ph);

    // 行前約定（第一站）
    if (k === 0 && TOUR.rules) {
      var rb = el("div", "block rules", '<div class="lb">' + zy("出發前，我們約好：") + "</div>");
      var ol = el("ol");
      TOUR.rules.forEach(function (r) { ol.appendChild(el("li", "", zy(r))); say.push(r); });
      rb.appendChild(ol);
      sheet.appendChild(rb);
    }
    if (stn.lookFor) { sheet.appendChild(el("div", "block look", '<div class="lb">' + ICON.look + zy("找找看") + "</div><div>" + zy(stn.lookFor) + "</div>")); say.push(stn.lookFor); }
    if (stn.talk) { sheet.appendChild(el("div", "block talk", '<div class="lb">' + ICON.talk + zy("說說看") + "</div><div>" + zy(stn.talk) + "</div>")); say.push(stn.talk); }
    if (stn.learn) {
      var lr = el("button", "block learn", '<div class="lb">' + ICON.star + zy("我們學到") + '<small>（點一下打開）</small></div><div class="ans">' + zy(stn.learn) + "</div>");
      lr.onclick = function () { lr.classList.add("open"); };
      if (tour.on) lr.classList.add("open");
      sheet.appendChild(lr);
    }

    var foot = el("div", "foot");
    var n = k + 1 < ST.length ? k + 1 : -1;
    if (tour.on) foot.style.display = "none";
    var nx = el("button", "btn", zy(n === -1 ? "做家長分享圖" : "▶ 下一站：" + ST[n].name));
    nx.onclick = function () { closeCard(); if (n === -1) openShare(); else chooseStation(n); };
    foot.appendChild(nx);
    sheet.appendChild(foot);

    card.classList.add("show");
    document.body.classList.add("carded");
    onResize();
    refresh();
  }
  function closeCard() {
    card.classList.remove("show");
    document.body.classList.remove("carded");
    onResize();
  }

  /* ---------- 再走一次：自動導覽（參考 HEART 政策島的導覽做法，程式自己寫） ----------
   * 人物自己從學校走完全程，每到一站打開卡片、輪播照片，停 TOUR_SEC 秒再走下一站。
   * 空白鍵暫停、Esc 離開、H 隱藏按鈕（錄影用）。 */
  var TOUR_SEC = 9;
  var tour = { on: false, paused: false, k: 0, left: 0, phase: "", last: 0 };
  function tourBar() {
    $("tourBar").hidden = !tour.on;
    $("tourPause").textContent = tour.paused ? "▶ 繼續" : "❚❚ 暫停";
    $("tourCount").textContent = (tour.k + 1) + " / " + ST.length + "　" + ST[tour.k].name;
    document.body.classList.toggle("touring", tour.on);
  }
  function startTour() {
    closeMenu(); closeIntro();
    if ($("share").classList.contains("show")) closeShare();
    tour.on = true; tour.paused = false; tour.k = 0;
    document.body.classList.remove("capture");
    camMode = "follow"; $("viewBtn").classList.remove("on");
    teleport(0, function () { tourArrive(); });
    tourBar();
  }
  function tourArrive() {
    if (!tour.on) return;
    showIdx = 0;
    openStation(tour.k);
    tour.phase = "dwell"; tour.left = TOUR_SEC; tour.photoT = 0;
    tourBar();
  }
  function tourNext() {
    if (tour.k + 1 >= ST.length) { tour.phase = "end"; finishTour(); return; }
    closeCard();
    tour.phase = "walk";
    tour.k++;
    tourBar();
    walkTo(tour.k, function () { tourArrive(); });
  }
  function finishTour() {
    stopTour();
    toast(ART.kid("cheer"), "我們走完一圈了！");
  }
  function stopTour() {
    if (!tour.on) return;
    tour.on = false; tour.phase = "";
    document.body.classList.remove("capture");
    tourBar();
    if (cardOpen()) openStation(state.at); // 換回一般的卡片
  }
  // 每一幀呼叫：倒數停留時間、輪播照片
  function tourTick(dt) {
    if (!tour.on || tour.paused || tour.phase !== "dwell") return;
    tour.left -= dt;
    var list = photos[ST[tour.k].id] || [];
    if (list.length > 1) {
      tour.photoT += dt;
      if (tour.photoT > TOUR_SEC / list.length) { tour.photoT = 0; showIdx = (showIdx + 1) % list.length; openStation(tour.k); }
    }
    if (tour.left <= 0) tourNext();
  }
  $("tourBtn").onclick = startTour;
  $("tourMenuBtn").onclick = startTour;
  $("tourPause").onclick = function () { tour.paused = !tour.paused; tourBar(); };
  $("tourReplay").onclick = startTour;
  $("tourStop").onclick = function () { stopTour(); closeCard(); };

  /* ---------- 第一次打開：三張說明卡（參考兩座政策島的引導；看過就不再跳，按「?」可以重看） ---------- */
  var INTRO = [
    ["這是我們走過的社區", "地圖照真實的路線做成。按下方的大按鈕，人物會一站一站走過去，每一站有「找找看」「說說看」「我們學到」。"],
    ["每一站都能放照片", "點站牌或上方的地點打開卡片，按「放照片」從相簿選照片，一站最多三張。請只拍孩子的背影。"],
    ["走完可以再走一次", "按「再走一次」，人物會自己走完全程、輪播每一站的照片，適合課堂回顧或錄影給家長。最後在設定裡「做家長分享圖」，傳到班級 LINE 群組。"]
  ];
  var introK = 0, seenIntro = false;
  function showIntro(k) {
    introK = k || 0;
    var it = INTRO[introK], box = $("introBox");
    box.innerHTML = "";
    var x = el("button", "x", "✕"); x.setAttribute("aria-label", "關閉"); x.onclick = closeIntro;
    box.appendChild(x);
    box.appendChild(el("div", "introCount", "使用說明 " + (introK + 1) + " / " + INTRO.length));
    box.appendChild(el("h3", "", it[0]));
    box.appendChild(el("p", "note", it[1]));
    var row = el("div", "row");
    var skip = el("button", "btn gray", "略過");
    skip.onclick = closeIntro;
    var nx = el("button", "btn", introK < INTRO.length - 1 ? "下一步 →" : "開始使用");
    nx.onclick = function () { if (introK < INTRO.length - 1) showIntro(introK + 1); else closeIntro(); };
    row.appendChild(skip); row.appendChild(nx);
    box.appendChild(row);
    $("intro").classList.add("show");
    nx.focus();
  }
  function closeIntro() {
    if (!$("intro").classList.contains("show")) return;
    $("intro").classList.remove("show");
    try { localStorage.setItem("community-walk-intro", "1"); } catch (e) {}
  }
  $("intro").addEventListener("click", function (e) { if (e.target === $("intro")) closeIntro(); });
  $("helpBtn").onclick = function () { closeMenu(); showIntro(0); };

  /* ---------- 照片備份（換電腦時搬照片） ---------- */
  $("backupBtn").onclick = function () {
    closeMenu();
    try {
      var blob = new Blob([JSON.stringify({ app: "community-walk", version: 3, title: TOUR.title, photos: photos })], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "community-walk-photos.json";
      document.body.appendChild(a); a.click(); a.remove();
      toast(ART.check(), "照片已經打包下載。換電腦時，用「匯入照片」放回來。");
    } catch (e) { toast(ART.think(), "這個瀏覽器不能下載檔案。"); }
  };
  $("restoreBtn").onclick = function () {
    closeMenu();
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result);
          if (data.app !== "community-walk") throw 0;
          Object.keys(data.photos || {}).forEach(function (id) {
            var v = data.photos[id], list = Array.isArray(v) ? v : v ? [v] : [];
            photos[id] = list; dbPut(id, list.length ? list : null);
          });
          ST.forEach(function (_, k) { photoSprite(k); });
          toast(ART.check(), "照片放回來了！");
        } catch (e) { toast(ART.think(), "這個檔案讀不到，請用本網頁打包下載的檔案。"); }
      };
      rd.readAsText(f);
    };
    inp.click();
  };

  /* ---------- 家長分享圖：一張長圖，直接傳到班級 LINE 群組 ---------- */
  function loadImg(url) {
    return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = url; });
  }
  function wrapText(c, text, maxW) {
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var t = line + text[i];
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = text[i]; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function coverDraw(c, im, x, y, w, h, r) {
    c.save(); roundRect(c, x, y, w, h, r); c.clip();
    var s = Math.max(w / im.width, h / im.height);
    c.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
    c.restore();
  }
  // 拍一張全圖（不經過鏡頭動畫，馬上畫好再讀出來）
  function snapMap() {
    var old = { pos: camera.position.clone(), aspect: camera.aspect, w: renderer.domElement.width, h: renderer.domElement.height };
    var W = 1000, H = 720;
    renderer.setSize(W, H, false);
    camera.clearViewOffset();
    camera.aspect = W / H; camera.fov = 45; camera.updateProjectionMatrix();
    var t = new THREE.Vector3(-2, 0, 0), d = 78;
    camera.position.set(t.x + Math.sin(0.5) * Math.cos(1.05) * d, Math.sin(1.05) * d, t.z + Math.cos(0.5) * Math.cos(1.05) * d);
    camera.lookAt(t);
    renderer.render(scene, camera);
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.getContext("2d").drawImage(renderer.domElement, 0, 0, W, H);
    camera.position.copy(old.pos);
    onResize();
    return cv;
  }
  function makePoster() {
    var W = 1080, P = 48, INK = "#3b2f2a", F = "'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif";
    var list = ST.filter(function (s) { return s.learn; });
    var jobs = list.map(function (s) { var p = photos[s.id] || []; return p.length ? loadImg(p[0]) : Promise.resolve(null); });
    var map = snapMap();
    return Promise.all(jobs).then(function (imgs) {
      var tmp = document.createElement("canvas").getContext("2d");
      tmp.font = "32px " + F;
      var rows = list.map(function (s, i) {
        var lines = wrapText(tmp, s.learn, imgs[i] ? W - P * 2 - 470 : W - P * 2 - 150);
        var h = Math.max(imgs[i] ? 330 : 170, 120 + lines.length * 48);
        return { s: s, img: imgs[i], lines: lines, h: h };
      });
      var mapH = Math.round((W - P * 2) * map.height / map.width);
      var H = 250 + mapH + 60 + rows.reduce(function (a, r) { return a + r.h + 24; }, 0) + 150;
      var cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      var c = cv.getContext("2d");
      c.fillStyle = "#fffaf0"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#e8704a"; c.fillRect(0, 0, W, 16);
      c.fillStyle = INK; c.textBaseline = "alphabetic"; c.textAlign = "left";
      c.font = "bold 64px " + F; c.fillText(TOUR.title, P, 110);
      c.font = "34px " + F; c.fillStyle = "#7a6656";
      var d = new Date();
      c.fillText((TOUR.subtitle || "") + "　" + (d.getMonth() + 1) + "月" + d.getDate() + "日", P, 165);
      c.font = "30px " + F;
      c.fillText("我們走過的路，變成了一張地圖！", P, 215);
      var y = 250;
      c.save(); roundRect(c, P, y, W - P * 2, mapH, 28); c.clip();
      c.drawImage(map, P, y, W - P * 2, mapH); c.restore();
      c.lineWidth = 6; c.strokeStyle = INK; roundRect(c, P, y, W - P * 2, mapH, 28); c.stroke();
      y += mapH + 60;
      rows.forEach(function (r, i) {
        c.fillStyle = "#fff"; roundRect(c, P, y, W - P * 2, r.h, 26); c.fill();
        c.lineWidth = 4; c.strokeStyle = "#eadfce"; c.stroke();
        var tx = P + 30;
        if (r.img) { coverDraw(c, r.img, P + 24, y + 24, 400, r.h - 48, 18); tx = P + 450; }
        c.fillStyle = "#e8704a"; c.beginPath(); c.arc(tx + 26, y + 56, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff"; c.font = "bold 30px " + F; c.textAlign = "center"; c.fillText(String(i + 1), tx + 26, y + 67);
        c.textAlign = "left"; c.fillStyle = INK; c.font = "bold 40px " + F; c.fillText(r.s.name, tx + 66, y + 70);
        c.font = "32px " + F; c.fillStyle = "#5a4a3e";
        r.lines.forEach(function (ln, j) { c.fillText(ln, tx, y + 130 + j * 48); });
        y += r.h + 24;
      });
      c.fillStyle = "#7a6656"; c.font = "26px " + F; c.textAlign = "center";
      c.fillText("照片只拍孩子的背影。這張圖只分享在班級群組，請不要轉貼到公開的地方。", W / 2, H - 70);
      return cv;
    });
  }
  function openShare() {
    closeMenu();
    if (cardOpen()) closeCard();
    var box = $("shareBox"), have = ST.filter(function (s) { return (photos[s.id] || []).length; }).length;
    box.innerHTML = "";
    var sx = el("button", "x", "✕"); sx.setAttribute("aria-label", "關閉"); sx.onclick = closeShare;
    box.appendChild(sx);
    box.appendChild(el("h3", "", "家長分享圖"));
    box.appendChild(el("p", "note", "把今天走過的地圖、每一站的照片和學到的事，做成一張長圖，直接傳到班級 LINE 群組。" +
      (have ? "目前有 " + have + " 站放了照片。" : "<b>還沒有放照片</b>：在每一站的卡片上點「放照片」。")));
    var lb = el("label", "check", '<input type="checkbox" id="shareOk"> 我確認照片只拍到背影，沒有拍到臉、名牌、書包或水壺上的名字');
    box.appendChild(lb);
    var row = el("div", "row");
    var mk = el("button", "btn", "做分享圖");
    var cl = el("button", "btn gray", "關閉");
    cl.onclick = closeShare;
    row.appendChild(mk); row.appendChild(cl);
    box.appendChild(row);
    var out = el("div", "out");
    box.appendChild(out);
    mk.onclick = function () {
      if (!$("shareOk").checked) { toast(ART.think(), "請先勾選確認：照片只拍到背影。"); return; }
      mk.disabled = true; mk.textContent = "做圖中…"; making = true;
      makePoster().then(function (cv) {
        making = false;
        mk.disabled = false; mk.textContent = "重新做一次";
        out.innerHTML = "";
        var url = cv.toDataURL("image/jpeg", 0.88);
        var im = el("img"); im.src = url; im.alt = "家長分享圖";
        out.appendChild(im);
        cv.toBlob(function (b) { cv._blob = b; }, "image/jpeg", 0.88);
        var give = el("button", "btn", "傳到 LINE（分享）／下載");
        give.onclick = function () { givePoster(cv); };
        out.insertBefore(give, im);
      });
    };
    $("share").classList.add("show");
  }
  var making = false;
  function closeShare() { if (!making) $("share").classList.remove("show"); }
  // 彈跳視窗：× 、Esc、點外面都能關（做圖中暫時不能關）
  $("share").addEventListener("click", function (e) { if (e.target === $("share")) closeShare(); });
  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tour.on && e.code === "Space" && tag !== "INPUT" && tag !== "BUTTON") { e.preventDefault(); $("tourPause").click(); return; }
    if (tour.on && (e.key === "h" || e.key === "H")) { document.body.classList.toggle("capture"); return; }
    if (e.key !== "Escape") return;
    if ($("intro").classList.contains("show")) closeIntro();
    else if (tour.on) { stopTour(); closeCard(); }
    else if ($("share").classList.contains("show")) closeShare();
    else if (cardOpen()) closeCard();
    else closeMenu();
  });
  function givePoster(cv) {
    var d = new Date(), fname = "community-walk-" + (d.getMonth() + 1) + "-" + d.getDate() + ".jpg";
    function download(blob) {
      try {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = fname;
        document.body.appendChild(a); a.click(); a.remove();
        toast(ART.check(), "已經存成圖片，可以傳到班級群組了。");
      } catch (e) { toast(ART.think(), "這台裝置不能存檔，可以長按上面的圖片儲存。"); }
    }
    function give(blob) {
      if (!blob) { toast(ART.think(), "這台裝置不能存檔，可以長按上面的圖片儲存。"); return; }
      var file = null;
      try { file = new File([blob], fname, { type: "image/jpeg" }); } catch (e) {}
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (err) { if (!err || err.name !== "AbortError") download(blob); });
      } else download(blob);
    }
    if (cv._blob) give(cv._blob); else cv.toBlob(give, "image/jpeg", 0.88);
  }

  /* ---------- 畫面大小 ---------- */
  function onResize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 58 : 45;
    // 打開地點卡時，把 3D 畫面往左（直式往上）推，讓建築露在卡片旁邊
    var W = innerWidth, H = innerHeight;
    if (document.body.classList.contains("carded")) {
      if (W >= H) camera.setViewOffset(W, H, W * 0.22, 0, W, H);
      else camera.setViewOffset(W, H, 0, H * 0.24, W, H);
    } else camera.clearViewOffset();
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
    tourTick(dt);
    if (walking && !(tour.on && tour.paused)) {
      var step = 9 * dt;
      if (Math.abs(walkTarget - walkS) <= step) {
        walkS = walkTarget;
        walking = false;
        refresh();
        var cb = arriveCb; arriveCb = null;
        if (cb) setTimeout(cb, 250);
      } else walkS += Math.sign(walkTarget - walkS) * step;
    }
    kid.scale.setScalar(poofT > 0 ? 1 + Math.sin((1 - poofT / 0.45) * Math.PI) * 0.35 : 1);
    poofT = Math.max(0, poofT - dt);
    var w = pointAt(walkS);
    kid.position.set(w.p.x, walking ? Math.abs(Math.sin(time * 12)) * 0.25 : 0, w.p.z);
    var dir = walkTarget >= walkS ? w.d : w.d.clone().negate();
    if (walking) kid.rotation.y = Math.atan2(dir.x, dir.z);
    shadow.position.set(w.p.x, 0.11, w.p.z);
    if (walking) squadDir = walkTarget >= walkS ? 1 : -1;
    squad.forEach(function (m) {
      var q = pointAt(walkS + m.back * squadDir), d = squadDir > 0 ? q.d : q.d.clone().negate();
      m.obj.position.set(q.p.x - d.z * m.side, walking ? Math.abs(Math.sin(time * 12 + m.ph)) * 0.22 : 0, q.p.z + d.x * m.side);
      m.obj.rotation.y = Math.atan2(d.x, d.z);
      m.obj.visible = poofT <= 0;
    });
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
      if (ST[k].noBuilding) sg.sprite.visible = n === k || k === state.at || !!state.visited[ST[k].id];
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
  // 注音字型載入後，重畫站牌（畫布不會自動換字型）
  if (document.fonts && document.fonts.load) document.fonts.load("40px 'CW Bpmf'", "三").then(function () { refresh(); });
  loop();
  dbOpen(function () { dbAll(function () { ST.forEach(function (_, k) { photoSprite(k); }); }); });

  try { seenIntro = localStorage.getItem("community-walk-intro") === "1"; } catch (e) {}
  if (!seenIntro) setTimeout(function () { showIntro(0); }, 600);
  window.__ok = true;
  window.__walk = { state: state, openStation: openStation, chooseStation: chooseStation, openShare: openShare, makePoster: makePoster, startTour: startTour, tour: tour };
})();
