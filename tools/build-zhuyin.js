// 產生 js/zhuyin.js：常用讀音（字典）＋詞語讀音（多音字校正）
// 用法：node build-zhuyin.js <專案資料夾> [--review]
const fs = require('fs'), path = require('path');
const { pinyin, segment } = require('/tmp/zy/node_modules/pinyin-pro');
const OpenCC = require('/tmp/zy/node_modules/opencc-js');
const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const dir = process.argv[2];
const OVR = require('./zhuyin-overrides.js');

const INI = { b:'ㄅ',p:'ㄆ',m:'ㄇ',f:'ㄈ',d:'ㄉ',t:'ㄊ',n:'ㄋ',l:'ㄌ',g:'ㄍ',k:'ㄎ',h:'ㄏ',j:'ㄐ',q:'ㄑ',x:'ㄒ',zh:'ㄓ',ch:'ㄔ',sh:'ㄕ',r:'ㄖ',z:'ㄗ',c:'ㄘ',s:'ㄙ' };
const FIN = { a:'ㄚ',o:'ㄛ',e:'ㄜ',ai:'ㄞ',ei:'ㄟ',ao:'ㄠ',ou:'ㄡ',an:'ㄢ',en:'ㄣ',ang:'ㄤ',eng:'ㄥ',ong:'ㄨㄥ',er:'ㄦ',
  i:'ㄧ',ia:'ㄧㄚ',ie:'ㄧㄝ',iao:'ㄧㄠ',iu:'ㄧㄡ',ian:'ㄧㄢ',in:'ㄧㄣ',iang:'ㄧㄤ',ing:'ㄧㄥ',iong:'ㄩㄥ',
  u:'ㄨ',ua:'ㄨㄚ',uo:'ㄨㄛ',uai:'ㄨㄞ',ui:'ㄨㄟ',uan:'ㄨㄢ',un:'ㄨㄣ',uang:'ㄨㄤ',ueng:'ㄨㄥ',
  v:'ㄩ',ve:'ㄩㄝ',van:'ㄩㄢ',vn:'ㄩㄣ', 'ü':'ㄩ','üe':'ㄩㄝ','üan':'ㄩㄢ','ün':'ㄩㄣ' };
const TONE = { 1:'', 2:'ˊ', 3:'ˇ', 4:'ˋ', 0:'' };
function py2zy(py) {
  let m = py.match(/^([a-zü]+)([0-5]?)$/); if (!m) return null;
  let s = m[1], tone = m[2] || '0';
  s = s.replace('ü','v');
  let ini = '';
  for (const k of ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s']) if (s.startsWith(k)) { ini = k; break; }
  let fin = s.slice(ini.length);
  if (!ini) { // y / w 開頭
    if (s.startsWith('yu')) fin = 'v' + s.slice(2);
    else if (s.startsWith('y')) { fin = s.slice(1); if (!fin.startsWith('i')) fin = 'i' + fin; }
    else if (s.startsWith('w')) { fin = s.slice(1); if (!fin.startsWith('u')) fin = 'u' + fin; }
  }
  if (ini && 'jqx'.includes(ini) && fin.startsWith('u')) fin = 'v' + fin.slice(1);
  if (['zh','ch','sh','r','z','c','s'].includes(ini) && fin === 'i') fin = '';
  if (fin === 'iou') fin = 'iu'; if (fin === 'uei') fin = 'ui'; if (fin === 'uen') fin = 'un'; if (fin === 'un' && ini && 'jqx'.includes(ini)) fin = 'vn';
  if (fin === 'o' && 'bpmf'.includes(ini)) fin = 'o';
  if (fin === 'ue') fin = 've';
  const zf = fin === '' ? '' : FIN[fin];
  if (zf === undefined) return null;
  const z = (INI[ini] || '') + zf;
  return tone === '0' ? '˙' + z : z + TONE[tone];
}
const isHan = c => /[㐀-鿿]/.test(c);

// 收集所有含中文的字串
let corpus = [];
for (const f of ['data/tour.js', 'js/game.js']) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  // 取出所有連續的非英數字片段（含中文），確保每個用到的字都有讀音
  for (const m of src.match(/[^\x00-\x7f]+/g) || []) if (/[㐀-鿿]/.test(m)) corpus.push(m);
}
corpus = [...new Set(corpus)];

const chars = {}, words = {};
function readOf(text) { // 依語境的讀音（不做變調）
  const simp = t2s(text);
  const arr = pinyin(simp, { toneType: 'num', type: 'array', toneSandhi: false, nonZh: 'consecutive' });
  return arr;
}
// 單字預設讀音
const allChars = new Set(corpus.join('').split('').filter(isHan));
for (const c of allChars) {
  const py = pinyin(t2s(c), { toneType: 'num', toneSandhi: false });
  chars[c] = py2zy(py) || '';
}
// 詞語：用斷詞找出跟單字預設不同的讀音
const review = [];
for (const text of corpus) {
  const simp = t2s(text);
  let segs;
  try { segs = segment(simp, { toneType: 'num', format: 'AllArray', toneSandhi: false }); } catch (e) { segs = null; }
  if (!segs) continue;
  // segs: [[{origin,result}...]] or flat
  const flat = segs.flat ? segs.flat() : segs;
  let pos = 0;
  for (const sg of flat) {
    const o = sg.origin, len = o.length, trad = text.substr(pos, len);
    const pys = String(sg.result).split(' ');
    if (len > 1 && [...trad].every(isHan) && pys.length === len) {
      const zys = pys.map(py2zy);
      if (zys.some((z, k) => z && z !== chars[trad[k]])) words[trad] = zys;
    }
    pos += len;
  }
}
// 人工校正（臺灣讀音、多音字）
Object.assign(chars, OVR.chars);
for (const w of OVR.dropWords || []) delete words[w];
Object.assign(words, OVR.words);

const out = `/* 自動產生：tools/build-zhuyin.js。多音字請改 tools/zhuyin-overrides.js 後重新產生 */
window.ZHUYIN = (function () {
  var C = ${JSON.stringify(chars)};
  var W = ${JSON.stringify(words)};
  var MAX = 4;
  var BASE = ${JSON.stringify(OVR.base || {})};
  var NUM = "〇一二三四五六七八九十百千";
  function toneOf(ch, r) {
    if (!r) return 0;
    if (r.charAt(0) === "˙") return BASE[ch] || 0;
    var l = r.charAt(r.length - 1);
    return l === "ˊ" ? 2 : l === "ˇ" ? 3 : l === "ˋ" ? 4 : 1;
  }
  function read(text) {
    var out = [], i = 0;
    while (i < text.length) {
      var hit = null;
      for (var L = MAX; L >= 2; L--) { var w = text.substr(i, L); if (W[w]) { hit = W[w]; break; } }
      if (hit) { for (var k = 0; k < hit.length; k++) out.push(hit[k]); i += hit.length; }
      else { out.push(C[text[i]] || null); i++; }
    }
    // 「一」「不」變調（照國小課本標變調後的讀音）
    for (i = 0; i < text.length; i++) {
      var c = text[i], nx = text[i + 1], pv = text[i - 1];
      if (c !== "一" && c !== "不") continue;
      var t = nx ? toneOf(nx, out[i + 1]) : 0;
      if (c === "一") {
        if (pv && pv === nx && C[pv] && pv !== "一") { out[i] = "˙ㄧ"; continue; } // 點一點、看一看
        if (!t || pv === "第" || NUM.indexOf(nx) >= 0 || NUM.indexOf(pv) >= 0) { out[i] = "ㄧ"; continue; } // 數字、序數、句尾
        out[i] = t === 4 ? "ㄧˊ" : "ㄧˋ";
      } else {
        out[i] = t === 4 ? "ㄅㄨˊ" : "ㄅㄨˋ";
      }
    }
    return out;
  }
  return { read: read, C: C, W: W };
})();
`;
fs.writeFileSync(path.join(dir, 'js/zhuyin.js'), out);
console.log('chars', Object.keys(chars).length, 'words', Object.keys(words).length);
if (process.argv.includes('--review')) {
  // 列出多音字在每個字串中的讀音，供人工檢查
  const Z = eval(out.replace('window.ZHUYIN =', 'var ZZ =') + ';ZZ');
  const { polyphonic } = require('/tmp/zy/node_modules/pinyin-pro');
  const poly = new Set([...allChars].filter(c => { const p = polyphonic(t2s(c), { toneType: 'num' })[0]; return p && p.split(' ').length > 1; }));
  const seen = {};
  for (const text of corpus) {
    const r = Z.read(text);
    text.split('').forEach((c, k) => { if (poly.has(c)) { const key = c + r[k]; (seen[key] = seen[key] || []).push(text.slice(Math.max(0,k-3), k+4)); } });
  }
  for (const k of Object.keys(seen).sort()) console.log(k, '|', [...new Set(seen[k])].slice(0, 6).join(' / '));
  console.log('WORDS', JSON.stringify(words));
}
