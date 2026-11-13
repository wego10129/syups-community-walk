/*
 * 社區踏查地圖：角色與圖示（SVG）
 * 風格照 class-games／info-class 的小遊戲：深色粗外框、平塗色塊、腳下一圈影子。
 * 每個函式回傳一段 <svg> 字串；畫面程式用 ART.名稱() 取用。
 */
window.ART = (function () {
  var K = "#1B2836"; // 外框顏色
  var S = 'stroke="' + K + '" stroke-width="4" stroke-linejoin="round"';
  var s3 = 'stroke="' + K + '" stroke-width="3" stroke-linejoin="round"';
  var SKIN = "#FFE0BD";
  function svg(vb, body) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" aria-hidden="true">' + body + "</svg>"; }
  function shadow(cx, cy, rx) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="5" fill="rgba(0,0,0,.22)"/>'; }
  function eyes(y, x1, x2, happy) {
    if (happy) return '<path d="M' + (x1 - 4) + " " + y + " Q" + x1 + " " + (y - 5) + " " + (x1 + 4) + " " + y + " M" + (x2 - 4) + " " + y + " Q" + x2 + " " + (y - 5) + " " + (x2 + 4) + " " + y + '" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>';
    return '<circle cx="' + x1 + '" cy="' + y + '" r="3.5" fill="' + K + '"/><circle cx="' + x2 + '" cy="' + y + '" r="3.5" fill="' + K + '"/>';
  }
  function smile(y) { return '<path d="M43 ' + y + " Q50 " + (y + 6) + " 57 " + y + '" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>'; }
  function blush(y) { return '<ellipse cx="36" cy="' + y + '" rx="4" ry="2.5" fill="#F9A8A8"/><ellipse cx="64" cy="' + y + '" rx="4" ry="2.5" fill="#F9A8A8"/>'; }

  var A = {};

  /* 小黃帽：踏查的主角（和 3D 地圖裡的小朋友同一個人） */
  A.kid = function (pose) {
    var arms = pose === "cheer"
      ? '<path d="M28 66 L14 40" ' + S + ' stroke-linecap="round" fill="none"/><path d="M72 66 L86 40" ' + S + ' stroke-linecap="round" fill="none"/><circle cx="13" cy="37" r="6" fill="' + SKIN + '" ' + s3 + '/><circle cx="87" cy="37" r="6" fill="' + SKIN + '" ' + s3 + "/>"
      : '<path d="M28 68 L20 88" ' + S + ' stroke-linecap="round" fill="none"/><path d="M72 68 L80 88" ' + S + ' stroke-linecap="round" fill="none"/>';
    return svg("0 0 100 110", shadow(50, 104, 26) + arms +
      '<path d="M26 66 Q50 56 74 66 L76 100 Q50 105 24 100 Z" fill="#4A7FC1" ' + S + "/>" +
      '<path d="M30 62 L36 98 M70 62 L64 98" stroke="#E8704A" stroke-width="5"/>' +
      '<circle cx="50" cy="42" r="22" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M22 32 Q50 30 78 32 L80 36 Q50 33 20 36 Z" fill="#F6C445" ' + s3 + "/>" +
      '<path d="M28 33 Q30 10 50 10 Q70 10 72 33 Z" fill="#F6C445" ' + S + "/>" +
      eyes(44, 42, 58, pose === "cheer") + blush(52) + smile(53));
  };

  /* 警察：mood＝happy（預設）、run（追）、whistle（吹哨）、proud（抓到了） */
  A.police = function (mood) {
    var face = eyes(48, 42, 58, mood === "proud") + (mood === "whistle"
      ? '<circle cx="50" cy="58" r="4" fill="' + K + '"/><rect x="50" y="55" width="14" height="6" rx="2" fill="#E5E7EB" ' + s3 + '/>'
      : mood === "run" ? '<path d="M43 56 L57 56" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/><path d="M34 40 L44 42 M66 40 L56 42" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>'
      : smile(56)) + (mood === "proud" ? blush(54) : "");
    var legs = mood === "run"
      ? '<path d="M38 98 L28 106 M62 98 L74 104" ' + S + ' stroke-linecap="round" fill="none"/>' : "";
    return svg("0 0 100 110", shadow(50, 104, 28) + legs +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#7DB4E6" ' + S + "/>" +
      '<path d="M46 62 L50 82 L54 62 Z" fill="#1E3A6E" ' + s3 + "/>" +
      '<circle cx="50" cy="42" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M26 30 Q50 6 74 30 L74 34 L26 34 Z" fill="#1E3A6E" ' + S + "/>" +
      '<path d="M22 34 L78 34 L72 40 L28 40 Z" fill="#14284D" ' + s3 + "/>" +
      '<circle cx="50" cy="24" r="5" fill="#FACC15" ' + s3 + "/>" + face +
      '<rect x="62" y="74" width="10" height="7" rx="2" fill="#FACC15" ' + s3 + "/>");
  };

  /* 小偷：mood＝smug（得意）、worried（緊張）、caught（被銬住）；舊的 true／false 也可以用 */
  A.thief = function (mood) {
    if (mood === true) mood = "caught";
    if (!mood) mood = "smug";
    var caught = mood === "caught";
    var cuffs = caught ? '<circle cx="40" cy="88" r="7" fill="none" stroke="#9CA3AF" stroke-width="4"/><circle cx="60" cy="88" r="7" fill="none" stroke="#9CA3AF" stroke-width="4"/><path d="M47 88 L53 88" stroke="#9CA3AF" stroke-width="4"/>' : "";
    var sweat = '<path d="M72 28 Q76 36 72 40 Q68 36 72 28 Z" fill="#7DD3FC" stroke="' + K + '" stroke-width="2"/>';
    var mask = '<path d="M28 38 Q50 32 72 38 L70 48 Q50 44 30 48 Z" fill="' + K + '"/>';
    var face = caught
      ? '<path d="M38 40 L44 46 M44 40 L38 46 M56 40 L62 46 M62 40 L56 46" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/><path d="M42 57 Q50 51 58 57" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>' + sweat
      : mood === "worried"
        ? mask + '<circle cx="41" cy="43" r="3.5" fill="#fff"/><circle cx="59" cy="43" r="3.5" fill="#fff"/><ellipse cx="50" cy="57" rx="4" ry="3" fill="' + K + '"/>' + sweat
        : mask + '<path d="M38 42 L44 42 M56 42 L62 42" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M42 54 Q52 60 60 52" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>';
    var sack = caught ? "" : '<path d="M70 58 Q92 50 90 76 Q80 86 68 76 Z" fill="#C8A26B" ' + S + '/><path d="M72 58 L76 52" ' + s3 + "/>";
    return svg("0 0 100 110", shadow(50, 104, 28) + sack +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#F3F4F6" ' + S + "/>" +
      '<path d="M25 74 L77 74 M24 84 L78 84 M23 94 L79 94" stroke="' + K + '" stroke-width="4"/>' + cuffs +
      '<circle cx="50" cy="44" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M28 38 Q28 14 50 14 Q72 14 72 38 Z" fill="#374151" ' + S + "/>" +
      '<circle cx="50" cy="12" r="5" fill="#374151" ' + s3 + "/>" + face);
  };

  /* 郵差 */
  A.postman = function () {
    return svg("0 0 100 110", shadow(50, 104, 28) +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#2F8A4F" ' + S + "/>" +
      '<path d="M28 62 L70 96" stroke="#8A6142" stroke-width="5"/>' +
      '<rect x="60" y="82" width="26" height="18" rx="4" fill="#C8A26B" ' + S + "/>" +
      '<path d="M64 86 L73 92 L82 86" fill="none" stroke="' + K + '" stroke-width="2.5"/>' +
      '<circle cx="50" cy="42" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M27 32 Q50 10 73 32 Z" fill="#2F8A4F" ' + S + "/>" +
      '<path d="M24 32 L82 32 L78 38 L26 38 Z" fill="#1F6B3A" ' + s3 + "/>" +
      eyes(47, 42, 58) + blush(54) + smile(55));
  };

  /* 消防員 */
  A.firefighter = function () {
    return svg("0 0 100 110", shadow(50, 104, 28) +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#E7B53B" ' + S + "/>" +
      '<path d="M24 82 L78 82" stroke="#E5E7EB" stroke-width="6"/><path d="M24 82 L78 82" stroke="' + K + '" stroke-width="1.5"/>' +
      '<circle cx="50" cy="44" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M26 36 Q26 10 50 10 Q74 10 74 36 Z" fill="#DC2626" ' + S + "/>" +
      '<path d="M18 36 L82 36 L84 42 L16 42 Z" fill="#B91C1C" ' + s3 + "/>" +
      '<rect x="44" y="18" width="12" height="12" rx="2" fill="#FACC15" ' + s3 + "/>" +
      eyes(50, 42, 58) + smile(58));
  };

  /* 圖書館員 */
  A.librarian = function () {
    return svg("0 0 100 110", shadow(50, 104, 28) +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#9A6FC1" ' + S + "/>" +
      '<rect x="34" y="74" width="32" height="22" rx="3" fill="#4A7FC1" ' + S + '/><path d="M50 74 L50 96" ' + s3 + "/>" +
      '<circle cx="50" cy="44" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M29 44 Q26 20 50 20 Q74 20 71 44 Q64 30 50 30 Q36 30 29 44 Z" fill="#5B3A29" ' + S + "/>" +
      '<circle cx="50" cy="16" r="8" fill="#5B3A29" ' + s3 + "/>" +
      '<circle cx="41" cy="46" r="6" fill="#fff" ' + s3 + '/><circle cx="59" cy="46" r="6" fill="#fff" ' + s3 + '/><path d="M47 46 L53 46" ' + s3 + "/>" +
      '<circle cx="41" cy="46" r="2.4" fill="' + K + '"/><circle cx="59" cy="46" r="2.4" fill="' + K + '"/>' + smile(56));
  };

  /* 銀行行員 */
  A.banker = function () {
    return svg("0 0 100 110", shadow(50, 104, 28) +
      '<path d="M24 64 Q50 54 76 64 L78 100 Q50 105 22 100 Z" fill="#2E7D6B" ' + S + "/>" +
      '<path d="M42 60 L50 76 L58 60 Z" fill="#fff" ' + s3 + '/><path d="M48 66 L50 84 L52 66 Z" fill="#E8704A" stroke="' + K + '" stroke-width="2"/>' +
      '<circle cx="50" cy="42" r="21" fill="' + SKIN + '" ' + S + "/>" +
      '<path d="M29 38 Q28 20 50 20 Q72 20 71 38 Q62 28 48 30 Q36 30 29 38 Z" fill="#2B2B2B" ' + S + "/>" +
      eyes(46, 42, 58) + blush(53) + smile(54));
  };

  /* 郵筒（紅、綠） */
  A.mailbox = function (color) {
    var c = color === "green" ? "#2F8A4F" : color === "blue" ? "#3B6FB6" : "#D8392B";
    return svg("0 0 100 110", shadow(50, 104, 26) +
      '<rect x="40" y="80" width="20" height="22" fill="#6B7280" ' + S + "/>" +
      '<path d="M24 82 L24 40 Q24 14 50 14 Q76 14 76 40 L76 82 Z" fill="' + c + '" ' + S + "/>" +
      '<rect x="34" y="40" width="32" height="7" rx="3" fill="' + K + '"/>' +
      '<rect x="36" y="56" width="28" height="16" rx="3" fill="#fff" ' + s3 + '/><path d="M38 59 L50 66 L62 59" fill="none" stroke="' + K + '" stroke-width="2.5"/>');
  };

  /* 告示牌：可以／不可以 */
  A.signOk = function () {
    return svg("0 0 100 110", shadow(50, 104, 22) + '<rect x="46" y="60" width="8" height="42" fill="#8A6142" ' + S + "/>" +
      '<rect x="14" y="10" width="72" height="56" rx="10" fill="#DCFCE7" ' + S + '/><circle cx="50" cy="38" r="16" fill="none" stroke="#16A34A" stroke-width="8"/>');
  };
  A.signNo = function () {
    return svg("0 0 100 110", shadow(50, 104, 22) + '<rect x="46" y="60" width="8" height="42" fill="#8A6142" ' + S + "/>" +
      '<rect x="14" y="10" width="72" height="56" rx="10" fill="#FEE2E2" ' + S + '/><path d="M36 24 L64 52 M64 24 L36 52" stroke="#DC2626" stroke-width="8" stroke-linecap="round"/>');
  };

  /* 火、熄滅後的煙和水滴 */
  A.fire = function () {
    return svg("0 0 100 110", shadow(50, 104, 26) +
      '<path d="M50 8 Q66 30 72 44 Q80 30 78 22 Q96 50 86 76 Q78 100 50 100 Q22 100 14 76 Q8 54 24 36 Q26 50 32 54 Q30 30 50 8 Z" fill="#F97316" ' + S + "/>" +
      '<path d="M50 44 Q62 60 64 72 Q66 92 50 94 Q34 92 36 74 Q38 62 50 44 Z" fill="#FDE047" ' + s3 + "/>");
  };
  A.smoke = function () {
    return svg("0 0 100 110", shadow(50, 104, 26) +
      '<path d="M26 86 Q14 86 16 72 Q18 60 30 62 Q30 46 46 46 Q58 40 66 52 Q82 50 84 66 Q90 80 76 86 Z" fill="#E5E7EB" ' + S + "/>" +
      '<path d="M30 24 Q36 14 40 24 Q40 32 35 32 Q30 32 30 24 Z M58 14 Q64 4 68 14 Q68 22 63 22 Q58 22 58 14 Z" fill="#7DD3FC" ' + s3 + "/>");
  };

  /* 樹苗、大樹 */
  A.sprout = function () {
    return svg("0 0 100 110", shadow(50, 104, 26) +
      '<path d="M20 100 Q50 76 80 100 Z" fill="#A16207" ' + S + "/>" +
      '<path d="M50 90 L50 60" ' + S + "/>" +
      '<path d="M50 66 Q30 66 28 48 Q46 46 50 66 Z" fill="#84CC16" ' + s3 + '/><path d="M50 62 Q70 62 72 44 Q54 42 50 62 Z" fill="#84CC16" ' + s3 + "/>");
  };
  A.tree = function () {
    return svg("0 0 100 110", shadow(50, 104, 26) +
      '<rect x="42" y="64" width="16" height="38" fill="#8A6142" ' + S + "/>" +
      '<circle cx="50" cy="40" r="32" fill="#4F9A55" ' + S + "/>" +
      '<circle cx="38" cy="32" r="6" fill="#86C56F"/><circle cx="60" cy="48" r="5" fill="#86C56F"/>');
  };

  /* 小豬撲滿；full＝存滿了 */
  A.pig = function (full) {
    var coins = full ? '<circle cx="40" cy="14" r="9" fill="#FACC15" ' + s3 + '/><circle cx="60" cy="10" r="9" fill="#FACC15" ' + s3 + '/><text x="40" y="18" font-size="11" font-weight="700" text-anchor="middle" fill="' + K + '">5</text><text x="60" y="14" font-size="11" font-weight="700" text-anchor="middle" fill="' + K + '">5</text>' : "";
    return svg("0 0 100 110", shadow(50, 104, 30) + coins +
      '<rect x="26" y="84" width="10" height="16" rx="3" fill="#F9A8D4" ' + s3 + '/><rect x="64" y="84" width="10" height="16" rx="3" fill="#F9A8D4" ' + s3 + "/>" +
      '<ellipse cx="50" cy="64" rx="38" ry="28" fill="#F9A8D4" ' + S + "/>" +
      '<path d="M30 40 L28 26 L42 36 Z" fill="#F9A8D4" ' + s3 + "/>" +
      '<rect x="40" y="38" width="20" height="5" rx="2" fill="' + K + '"/>' +
      '<ellipse cx="86" cy="66" rx="8" ry="10" fill="#F472B6" ' + s3 + '/><circle cx="84" cy="63" r="1.8" fill="' + K + '"/><circle cx="84" cy="70" r="1.8" fill="' + K + '"/>' +
      (full ? '<path d="M64 54 Q68 50 72 54" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>' : '<circle cx="68" cy="54" r="3.5" fill="' + K + '"/>'));
  };

  /* 數學題的小圖：橘子、硬幣、書 */
  A.orange = function () { return svg("0 0 40 40", '<circle cx="20" cy="22" r="15" fill="#FB923C" stroke="' + K + '" stroke-width="3"/><path d="M20 7 Q26 2 30 6 Q24 10 20 7 Z" fill="#4F9A55" stroke="' + K + '" stroke-width="2"/>'); };
  A.coin = function () { return svg("0 0 40 40", '<circle cx="20" cy="20" r="16" fill="#FACC15" stroke="' + K + '" stroke-width="3"/><circle cx="20" cy="20" r="10" fill="none" stroke="#CA8A04" stroke-width="2"/>'); };
  A.book = function () { return svg("0 0 40 40", '<rect x="7" y="5" width="26" height="30" rx="3" fill="#E5484D" stroke="' + K + '" stroke-width="3"/><rect x="11" y="10" width="16" height="6" rx="1" fill="#fff"/>'); };

  A.drop = function () { return svg("0 0 40 40", '<path d="M20 4 Q32 20 30 27 Q28 36 20 36 Q12 36 10 27 Q8 20 20 4 Z" fill="#7DD3FC" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>'); };
  A.helmet = function () { return svg("0 0 40 40", '<path d="M6 26 Q6 8 20 8 Q34 8 34 26 Z" fill="#DC2626" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/><path d="M3 26 L37 26 L37 31 L3 31 Z" fill="#B91C1C" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/><rect x="16" y="13" width="8" height="8" fill="#FACC15" stroke="' + K + '" stroke-width="2"/>'); };
  A.leaf = function () { return svg("0 0 40 40", '<rect x="17" y="24" width="6" height="12" fill="#8A6142" stroke="' + K + '" stroke-width="2.5"/><circle cx="20" cy="17" r="13" fill="#4F9A55" stroke="' + K + '" stroke-width="3"/>'); };
  A.flower = function () { return svg("0 0 40 40", '<path d="M20 22 L20 38" stroke="#16A34A" stroke-width="3"/><circle cx="20" cy="10" r="6" fill="#F472B6" stroke="' + K + '" stroke-width="2.5"/><circle cx="12" cy="17" r="6" fill="#F472B6" stroke="' + K + '" stroke-width="2.5"/><circle cx="28" cy="17" r="6" fill="#F472B6" stroke="' + K + '" stroke-width="2.5"/><circle cx="20" cy="22" r="6" fill="#F472B6" stroke="' + K + '" stroke-width="2.5"/><circle cx="20" cy="16" r="4" fill="#FACC15" stroke="' + K + '" stroke-width="2"/>'); };
  A.cross = function () { return svg("0 0 40 40", '<circle cx="20" cy="20" r="17" fill="#EF4444" stroke="' + K + '" stroke-width="3"/><path d="M13 13 L27 27 M27 13 L13 27" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'); };

  /* 小圖示 */
  A.star = function (on) { return svg("0 0 40 40", '<path d="M20 3 L25 15 L38 15 L28 23 L32 36 L20 28 L8 36 L12 23 L2 15 L15 15 Z" fill="' + (on === false ? "#E5E7EB" : "#FACC15") + '" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>'); };
  A.check = function () { return svg("0 0 40 40", '<circle cx="20" cy="20" r="17" fill="#22C55E" stroke="' + K + '" stroke-width="3"/><path d="M11 20 L18 27 L30 13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'); };
  A.cuffs = function () { return svg("0 0 40 40", '<circle cx="13" cy="22" r="9" fill="none" stroke="' + K + '" stroke-width="5"/><circle cx="27" cy="22" r="9" fill="none" stroke="' + K + '" stroke-width="5"/><circle cx="13" cy="22" r="9" fill="none" stroke="#CBD5E1" stroke-width="2.5"/><circle cx="27" cy="22" r="9" fill="none" stroke="#CBD5E1" stroke-width="2.5"/>'); };
  A.think = function () { return svg("0 0 40 40", '<circle cx="20" cy="20" r="17" fill="#FDE68A" stroke="' + K + '" stroke-width="3"/><text x="20" y="28" font-size="22" font-weight="800" text-anchor="middle" fill="' + K + '">?</text>'); };
  A.speaker = function () { return svg("0 0 40 40", '<path d="M6 15 L13 15 L22 7 L22 33 L13 25 L6 25 Z" fill="#fff" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/><path d="M27 14 Q32 20 27 26 M31 10 Q39 20 31 30" fill="none" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>'); };
  A.magnifier = function () { return svg("0 0 40 40", '<circle cx="17" cy="17" r="11" fill="#E0F2FE" stroke="' + K + '" stroke-width="4"/><path d="M25 25 L35 35" stroke="' + K + '" stroke-width="6" stroke-linecap="round"/>'); };
  A.map = function () { return svg("0 0 40 40", '<path d="M4 9 L14 5 L26 9 L36 5 L36 31 L26 35 L14 31 L4 35 Z" fill="#FEF3C7" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/><path d="M14 5 L14 31 M26 9 L26 35" stroke="' + K + '" stroke-width="2.5"/><circle cx="20" cy="18" r="3.5" fill="#E8704A" stroke="' + K + '" stroke-width="2"/>'); };

  /* 各站的小圖示（站牌、印章、任務卡） */
  function b(body) { return svg("0 0 64 64", body); }
  var o = 'stroke="' + K + '" stroke-width="3.5" stroke-linejoin="round"';
  A.icon = {
    school: function () { return b('<rect x="8" y="26" width="48" height="30" fill="#8A2F2F" ' + o + '/><path d="M8 26 L32 10 L56 26 Z" fill="#E9E4DC" ' + o + '/><rect x="27" y="40" width="10" height="16" fill="#F6C445" ' + o + '/><rect x="14" y="32" width="8" height="7" fill="#fff"/><rect x="42" y="32" width="8" height="7" fill="#fff"/><path d="M32 10 L32 2 L42 5 L32 8" fill="#E8704A" stroke="' + K + '" stroke-width="2"/>'); },
    temple: function () { return b('<rect x="12" y="30" width="40" height="26" fill="#C8402F" ' + o + '/><path d="M4 32 Q32 12 60 32 L54 26 Q32 10 10 26 Z" fill="#2F8A6D" ' + o + '/><rect x="26" y="40" width="12" height="16" fill="#8A2A1F" ' + o + '/><circle cx="18" cy="40" r="3.5" fill="#FACC15" stroke="' + K + '" stroke-width="2"/><circle cx="46" cy="40" r="3.5" fill="#FACC15" stroke="' + K + '" stroke-width="2"/>'); },
    bank: function () { return b('<path d="M6 24 L32 8 L58 24 Z" fill="#2E7D6B" ' + o + '/><rect x="8" y="24" width="48" height="6" fill="#F1EDE4" ' + o + '/><rect x="13" y="30" width="6" height="20" fill="#fff" ' + o + '/><rect x="29" y="30" width="6" height="20" fill="#fff" ' + o + '/><rect x="45" y="30" width="6" height="20" fill="#fff" ' + o + '/><rect x="6" y="50" width="52" height="7" fill="#D7D2C8" ' + o + "/>"); },
    post: function () { return b('<rect x="8" y="18" width="48" height="38" rx="4" fill="#EFF0E6" ' + o + '/><rect x="6" y="12" width="52" height="10" rx="3" fill="#2F8A4F" ' + o + '/><rect x="16" y="30" width="32" height="20" rx="2" fill="#fff" ' + o + '/><path d="M18 32 L32 42 L46 32" fill="none" stroke="' + K + '" stroke-width="3"/>'); },
    police: function () { return b('<rect x="8" y="20" width="48" height="36" fill="#F3F5F8" ' + o + '/><rect x="8" y="30" width="48" height="7" fill="#2F5FA8"/><rect x="8" y="20" width="48" height="36" fill="none" ' + o + '/><rect x="24" y="8" width="8" height="10" fill="#E2382B" ' + o + '/><rect x="32" y="8" width="8" height="10" fill="#2F6FE0" ' + o + '/><rect x="26" y="42" width="12" height="14" fill="#6D8FB7" ' + o + "/>"); },
    fire: function () { return b('<rect x="6" y="20" width="44" height="36" fill="#D8473A" ' + o + '/><rect x="46" y="8" width="12" height="48" fill="#C23C31" ' + o + '/><rect x="12" y="34" width="14" height="22" fill="#555B66" ' + o + '/><rect x="30" y="34" width="14" height="22" fill="#555B66" ' + o + "/>"); },
    library: function () { return b('<rect x="8" y="10" width="10" height="44" fill="#E8704A" ' + o + '/><rect x="18" y="16" width="10" height="38" fill="#4A7FC1" ' + o + '/><rect x="28" y="8" width="10" height="46" fill="#F6C445" ' + o + '/><rect x="40" y="14" width="12" height="40" fill="#3F9B5F" ' + o + ' transform="rotate(12 46 34)"/><rect x="4" y="54" width="56" height="5" fill="#8A6142" ' + o + "/>"); },
    park: function () { return b('<rect x="28" y="36" width="8" height="20" fill="#8A6142" ' + o + '/><circle cx="32" cy="26" r="18" fill="#4F9A55" ' + o + '/><rect x="6" y="50" width="20" height="5" fill="#C8A26B" ' + o + '/><rect x="40" y="50" width="20" height="5" fill="#C8A26B" ' + o + "/>"); },
    river: function () { return b('<path d="M4 22 Q14 14 24 22 T44 22 T64 22" fill="none" stroke="' + K + '" stroke-width="9" stroke-linecap="round"/><path d="M4 22 Q14 14 24 22 T44 22 T64 22" fill="none" stroke="#67BFE3" stroke-width="4.5" stroke-linecap="round"/><path d="M4 40 Q14 32 24 40 T44 40 T64 40" fill="none" stroke="' + K + '" stroke-width="9" stroke-linecap="round"/><path d="M4 40 Q14 32 24 40 T44 40 T64 40" fill="none" stroke="#67BFE3" stroke-width="4.5" stroke-linecap="round"/><ellipse cx="44" cy="52" rx="8" ry="4" fill="#F97316" ' + o + "/>"); },
    letter: function () { return b('<rect x="6" y="14" width="52" height="36" rx="4" fill="#FFF4DC" ' + o + '/><path d="M8 16 L32 34 L56 16" fill="none" ' + o + '/><rect x="42" y="20" width="10" height="10" fill="#E5484D" stroke="' + K + '" stroke-width="2"/>'); }
  };
  A.iconFor = function (stn) { return (A.icon[stn.id === "finish" ? "letter" : stn.kind] || A.icon.letter)(); };
  return A;
})();
