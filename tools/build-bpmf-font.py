# 產生 js/bpmf-font.js：注音字型（只含用到的字）＋破音字讀音順序
# 做法照 class-games（notes/zhuyin.md）：字型 Bpmf Zihi Kai Std（ButTaiwan bpmfvs，SIL OFL 1.1）
# 用法：
#   pip install fonttools brotli
#   python3 tools/build-bpmf-font.py <專案資料夾> <bpmfvs>/phonetic/phonic_table_Z.txt BpmfZihiKaiStd_400Regular.ttf
# 字型來源：npm 套件 @expo-google-fonts/bpmf-zihi-kai-std 的 TTF
# 每次改了 data/tour.js 或 js/zhuyin.js（加了新的字），都要重跑一次。
import re, sys, json, base64, subprocess, tempfile, os

root, table, ttf = sys.argv[1:4]
src = open(os.path.join(root, 'js/zhuyin.js'), encoding='utf-8').read()
C = json.loads(re.search(r'var C = (\{.*?\});', src, re.S).group(1))
W = json.loads(re.search(r'var W = (\{.*?\});', src, re.S).group(1))

han = re.compile(r'[㐀-鿿]')
chars = set(C) | set(''.join(W))
for f in ['data/tour.js', 'js/game.js', 'index.html']:
    chars |= set(han.findall(open(os.path.join(root, f), encoding='utf-8').read()))
chars = sorted(chars)

tab = {}
for line in open(table, encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 4 and len(p[0]) == 1:
        tab.setdefault(p[0], p[3:])

# 程式會用到的讀音（字典、詞語、「一」「不」變調）
used = {c: set() for c in chars}
for c, r in C.items():
    used[c].add(r)
for w, rs in W.items():
    for c, r in zip(w, rs):
        used[c].add(r)
used['一'] |= {'ㄧ', 'ㄧˊ', 'ㄧˋ'}
used['不'] |= {'ㄅㄨˊ', 'ㄅㄨˋ'}

missing_char = [c for c in chars if c not in tab]
missing_read = [(c, r) for c in chars if c in tab for r in used[c] if r and r not in tab[c]]
if missing_char:
    print('字型沒有這些字（會用系統字型、沒有注音）：', ''.join(missing_char))
if missing_read:
    print('字型裡沒有這些讀音（會顯示第一個讀音）：', missing_read)

# 只記多音字的讀音順序；第 n 個讀音（從 0 起算）在字後面加 U+E01E0+n
order = {c: tab[c] for c in chars if c in tab and len(tab[c]) > 1}

with tempfile.TemporaryDirectory() as d:
    open(f'{d}/c.txt', 'w', encoding='utf-8').write(''.join(chars))
    subprocess.run(['pyftsubset', ttf, f'--text-file={d}/c.txt',
                    '--unicodes=U+E01E0-E01EF,U+FF0C,U+FF1F,U+FF01,U+FF1A,U+3001,U+3002,U+300C,U+300D,U+FF08,U+FF09',
                    '--flavor=woff2', '--layout-features=*', f'--output-file={d}/f.woff2'], check=True)
    font = base64.b64encode(open(f'{d}/f.woff2', 'rb').read()).decode()

out = ('/* 自動產生：tools/build-bpmf-font.py。字型 Bpmf Zihi Kai Std（ButTaiwan bpmfvs，SIL OFL 1.1），只含本專案用到的字 */\n'
       '(function () {\n'
       '  var st = document.createElement("style");\n'
       '  st.textContent = "@font-face{font-family:\'CW Bpmf\';src:url(data:font/woff2;base64,' + font + ') format(\'woff2\');font-display:swap}";\n'
       '  document.head.appendChild(st);\n'
       '  window.BPMF_ORDER = ' + json.dumps(order, ensure_ascii=False) + ';\n'
       '})();\n')
open(os.path.join(root, 'js/bpmf-font.js'), 'w', encoding='utf-8').write(out)
print(len(chars), 'chars, font', len(font) // 1024, 'KB base64')
