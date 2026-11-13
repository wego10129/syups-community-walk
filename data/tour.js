/*
 * 社區踏查地圖：內容資料檔（第 2 版）
 * ------------------------------------------------------------
 * 這個檔案只放「內容」：路線、站點、題目。畫面程式在 js/game.js。
 *
 * 座標：route 與 pos 是地圖上的 [x, z]，照 Google 地圖截圖的相對位置換算。
 * lookFor：「到現場找找看」，行前先看、到現場再找答案（不放標準答案）。
 *
 * 題目類型：
 *   info   ：說明文字
 *   choice ：單選題，answer 是正確選項的序號（從 0 開始）
 *   math   ：乘法情境題，先選列式、再選答案；per = 每一份幾個，groups = 幾份
 *   order  ：依序點選，items 依「正確順序」填寫，畫面會打亂
 *   sort   ：分類小遊戲，一次出現一張卡，點正確的籃子
 *   chase  ：警察追小偷，一次一件事，判斷可以／不可以；答對警察前進，答錯小偷逃遠，答錯的題目稍後再出一次
 *   run    ：看圖列式小遊戲，每答對一題，畫面上一個圖示會變化（例如火被澆熄）
 *            乘法寫法：被乘數（一份有幾個，per）在前，乘數（有幾份，groups）在後；
 *            題目會刻意用兩種說法（先說份數／先說一份幾個），選項含前後對調的算式
 *   小遊戲的角色與圖案（host、before、after、art、item）都畫在 js/art.js
 *   pick2  ：從選項中選出兩個（地名挑戰：三角埔＋玉潮坑溪＝三玉）
 *   letter ：最後的寫信任務
 *
 * 數學題的數字都是「假設」的情境，不是真實資料。
 * 注音由 js/zhuyin.js 自動加上；多音字在該檔的 WORDS 表校正。
 */
window.TOUR = {
  title: "三玉社區踏查",
  subtitle: "二年級・生活 × 數學 × 國語",

  // 地圖中間的老地名
  center: { name: "三角埔", note: "以前的地名", tip: "這裡以前叫做「三角埔」！到玉潮坑溪那一站，找出三玉的祕密吧！" },

  // 玉潮坑溪的水道
  river: [[3.6, -13], [4.5, -6], [5.1, 0], [5.3, 6], [5, 12], [6.6, 17], [8.9, 22], [11.2, 25.4], [12.4, 33]],

  route: [
    [22.5, 25.5], // 0 三玉國小（出發）
    [10, 26],
    [-10, 26],
    [-22.5, 25.5], // 3 三玉宮
    [-21, 22],
    [-19.6, 14], // 5 臺灣銀行
    [-16, 8],
    [-13, 0],
    [-10.7, -8], // 8 天母郵局
    [-8.5, -15],
    [-6.8, -21],
    [-5.8, -24], // 11 派出所
    [-4.6, -27.5], // 12 消防分隊
    [-3.2, -24],
    [-3.4, -20],
    [-3.6, -15], // 15 圖書館
    [-1.5, -9.5],
    [1, -5],
    [2.6, 0],
    [3, 6], // 19 天和公園
    [2.5, 12],
    [4, 18],
    [6.5, 23.5],
    [10, 25.4],
    [22.5, 25.5] // 24 回到三玉國小
  ],

  stations: [
    {
      id: "start",
      name: "三玉國小",
      emoji: "🏫",
      kind: "school",
      at: 0,
      pos: [24, 12],
      rot: 0,
      lookFor: "出發前檢查：帽子戴好了嗎？水壺帶了嗎？",
      tasks: [
        {
          type: "info",
          text: "今天我們要從學校出發，走一圈社區，認識八個地方，最後回到學校寫一封信！每到一站，完成任務就能拿到一個印章。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "走在社區的路上，我們應該怎麼做？",
          options: ["走人行道，跟著隊伍走", "邊走邊玩追來追去", "自己先跑到最前面"],
          answer: 0,
          why: "走人行道、跟緊隊伍，過馬路看紅綠燈，大家才安全。"
        }
      ]
    },
    {
      id: "temple",
      name: "三玉宮",
      emoji: "🏮",
      kind: "temple",
      at: 3,
      pos: [-27, 27.5],
      lookFor: "到現場找找看：廟門口有沒有石獅子？屋頂上有什麼裝飾？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "廟宇是社區裡的什麼地方？",
          options: ["居民祈福、舉辦節慶活動的地方", "買菜的地方", "借書的地方"],
          answer: 0,
          why: "廟宇是大家祈福的地方，節慶時也常常是社區居民聚在一起的地方。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "參觀廟宇的時候，有禮貌的做法是？",
          options: ["大聲喊叫", "輕聲細語，不亂摸東西", "爬到桌子上看"],
          answer: 1,
          why: "廟裡有人在拜拜，要輕聲細語、尊重別人。"
        },
        {
          type: "math",
          subject: "數學",
          story: "假設廟裡的供桌上擺了四盤橘子，每一盤放五顆。",
          item: "orange",
          per: 5,
          groups: 4,
          unit: "顆",
          ask: "一共有幾顆橘子？"
        }
      ]
    },
    {
      id: "bank",
      name: "臺灣銀行",
      emoji: "🏦",
      kind: "bank",
      at: 5,
      pos: [-25, 12.5],
      lookFor: "到現場找找看：銀行門口有沒有提款機？招牌是什麼顏色？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "銀行可以幫我們做什麼？",
          options: ["借書、看書", "存錢、領錢", "寄信、寄包裹"],
          answer: 1,
          why: "銀行可以幫我們把錢存起來，需要的時候再領出來。"
        },
        {
          type: "run",
          subject: "數學",
          title: "幫行員數硬幣",
          story: "銀行裡有好多五元硬幣！先看圖，選出正確的乘法算式，就能把硬幣存進小豬撲滿。",
          host: "banker",
          before: "pig",
          after: "pigFull",
          rounds: [
            { q: "一個硬幣是五元，有三個硬幣，一共幾元？", item: "coin", per: 5, groups: 3, unit: "元" },
            { q: "有六個五元硬幣，一共幾元？", item: "coin", per: 5, groups: 6, unit: "元" },
            { q: "小美存了四個五元硬幣，一共幾元？", item: "coin", per: 5, groups: 4, unit: "元" },
            { q: "每個硬幣五元，存了七個，一共幾元？", item: "coin", per: 5, groups: 7, unit: "元" }
          ]
        }
      ]
    },
    {
      id: "post",
      name: "天母郵局",
      emoji: "📮",
      kind: "post",
      at: 8,
      pos: [-15.5, -8.5],
      lookFor: "到現場找找看：郵筒有哪兩種顏色？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "郵局可以幫我們做什麼？",
          options: ["幫忙看病", "寄信、寄包裹", "幫忙滅火"],
          answer: 1,
          why: "郵局可以寄信、寄包裹，也可以存錢。"
        },
        {
          type: "sort",
          subject: "國語",
          title: "幫郵差分類郵件",
          story: "郵差叔叔的郵件混在一起了！想一想，要說「一封」、「一張」還是「一個」，再把郵件放進對的郵筒。",
          host: "postman",
          card: "envelope",
          bins: [
            { name: "一封", art: "mailboxRed" },
            { name: "一張", art: "mailboxGreen" },
            { name: "一個", art: "mailboxBlue" }
          ],
          items: [
            { text: "信", bin: 0 },
            { text: "郵票", bin: 1 },
            { text: "包裹", bin: 2 },
            { text: "感謝信", bin: 0 },
            { text: "明信片", bin: 1 },
            { text: "紙箱", bin: 2 }
          ]
        },
        {
          type: "order",
          subject: "國語",
          q: "把詞語排成通順的句子！",
          hint: "先唸唸看：是誰？在什麼時候？做什麼事？",
          items: [
            { text: "郵差叔叔" },
            { text: "每天早上" },
            { text: "騎著機車" },
            { text: "把信" },
            { text: "送到我家。" }
          ]
        },
        {
          type: "math",
          subject: "數學",
          story: "小明要買三張郵票，假設一張郵票要六元。",
          item: "coin",
          per: 6,
          groups: 3,
          unit: "元",
          ask: "一共要付幾元？"
        }
      ]
    },
    {
      id: "police",
      name: "天母派出所",
      emoji: "👮",
      kind: "police",
      at: 11,
      pos: [-10.5, -24.5],
      lookFor: "到現場找找看：派出所門口停了什麼交通工具？",
      tasks: [
        {
          type: "chase",
          subject: "生活",
          title: "警察追小偷",
          host: "police",
          story: "小偷在社區裡溜來溜去！每看到一件事，判斷「可以」還是「不可以」。答對了，警察就往前追一步；答錯了，小偷就逃遠一步。",
          items: [
            { text: "隨便摸別人的身體", ok: false, why: "身體是自己的，別人不可以隨便碰。" },
            { text: "別人說「不要」，就停下來", ok: true, why: "尊重別人的感覺。" },
            { text: "掀別人的裙子", ok: false, why: "這會讓人很不舒服，不可以。" },
            { text: "不舒服的時候，大聲說「不要」", ok: true, why: "保護自己，說出來。" },
            { text: "沒問過就拍別人的照片", ok: false, why: "拍照前要先問別人可不可以。" },
            { text: "遇到怪怪的事，告訴老師或爸媽", ok: true, why: "信任的大人會幫忙。" },
            { text: "叫別人保守讓人不舒服的秘密", ok: false, why: "讓人不舒服的秘密，要告訴大人。" },
            { text: "在走廊上推擠同學", ok: false, why: "推擠很危險，會讓人受傷。" }
          ],
          end: "我們的身體是自己的，別人不可以隨便碰。遇到不舒服的事，要說「不要」，然後告訴信任的大人。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "要找警察幫忙，報案電話是幾號？",
          options: ["一一〇", "一一九", "一二三"],
          answer: 0,
          why: "報警打一一〇；火災和救護車是一一九。"
        }
      ]
    },
    {
      id: "fire",
      name: "消防局天母分隊",
      emoji: "🚒",
      kind: "fire",
      at: 12,
      pos: [-4.6, -32.5],
      lookFor: "到現場找找看：消防車停在哪裡？車子是什麼顏色？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "發生火災，或是有人需要救護車，要打幾號？",
          options: ["一一〇", "一一九", "一〇四"],
          answer: 1,
          why: "火災和緊急救護都打一一九，消防員會趕來幫忙。"
        },
        {
          type: "run",
          subject: "數學",
          title: "幫消防員滅火",
          story: "社區裡有四團火！看圖選出正確的乘法算式，消防員就能澆熄一團火。",
          host: "firefighter",
          before: "fire",
          after: "smoke",
          rounds: [
            { q: "有三桶水，每桶裝六瓢水，一共幾瓢？", item: "drop", per: 6, groups: 3, unit: "瓢" },
            { q: "每輛消防車坐四位消防員，來了五輛，一共幾位？", item: "helmet", per: 4, groups: 5, unit: "位" },
            { q: "有七條水管，每條接三個噴頭，一共幾個噴頭？", item: "drop", per: 3, groups: 7, unit: "個" },
            { q: "有兩輛消防車，每輛載八捲水管，一共幾捲？", item: "drop", per: 8, groups: 2, unit: "捲" }
          ]
        }
      ]
    },
    {
      id: "library",
      name: "圖書館天母分館",
      emoji: "📚",
      kind: "library",
      at: 15,
      pos: [1.5, -16.5],
      lookFor: "到現場找找看：圖書館外面有沒有還書箱？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "在圖書館可以做什麼？",
          options: ["借書、看書", "跑步比賽", "買零食"],
          answer: 0,
          why: "圖書館可以借書、看書，有時候還有說故事活動。"
        },
        {
          type: "sort",
          subject: "生活",
          title: "幫館員整理規則",
          story: "館員阿姨想做一張圖書館規則海報。幫她把這些事情分成「可以做」和「不可以做」吧！",
          host: "librarian",
          bins: [
            { name: "可以做", art: "signOk" },
            { name: "不可以做", art: "signNo" }
          ],
          items: [
            { text: "安靜的看書", bin: 0 },
            { text: "大聲聊天", bin: 1 },
            { text: "排隊借書", bin: 0 },
            { text: "在書上亂畫", bin: 1 },
            { text: "按時把書還回去", bin: 0 },
            { text: "邊看書邊吃東西", bin: 1 }
          ]
        },
        {
          type: "math",
          subject: "數學",
          story: "全組有七個小朋友，每個人借三本書。",
          item: "book",
          per: 3,
          groups: 7,
          unit: "本",
          ask: "全組一共借了幾本書？"
        }
      ]
    },
    {
      id: "park",
      name: "天和公園",
      emoji: "🌳",
      kind: "park",
      at: 19,
      pos: [10.5, 4],
      lookFor: "到現場找找看：公園裡有哪些遊樂設施？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "公園是社區裡的什麼地方？",
          options: ["大家運動、休息、玩耍的地方", "寄信的地方", "看醫生的地方"],
          answer: 0,
          why: "公園讓社區的大人小孩都有地方運動、散步和休息。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "在公園吃完點心，垃圾要怎麼辦？",
          options: ["丟在草地上", "藏在樹叢裡", "丟進垃圾桶，或帶回家"],
          answer: 2,
          why: "愛護公園，大家才能一直有乾淨的地方玩。"
        },
        {
          type: "run",
          subject: "數學",
          title: "幫公園種樹",
          story: "公園想多種一些樹！看圖選出正確的乘法算式，就能種下一棵大樹。",
          host: "kid",
          before: "sprout",
          after: "tree",
          rounds: [
            { q: "步道兩邊，每一邊種八棵樹，一共幾棵？", item: "leaf", per: 8, groups: 2, unit: "棵" },
            { q: "有九個花盆，每盆種兩朵花，一共幾朵？", item: "flower", per: 2, groups: 9, unit: "朵" },
            { q: "每排種三棵樹，種了六排，一共幾棵？", item: "leaf", per: 3, groups: 6, unit: "棵" },
            { q: "有四個花圃，每個花圃種七朵花，一共幾朵？", item: "flower", per: 7, groups: 4, unit: "朵" }
          ]
        }
      ]
    },
    {
      id: "river",
      name: "玉潮坑溪",
      emoji: "🏞️",
      kind: "river",
      at: 21,
      pos: [9, 18.5],
      lookFor: "到現場找找看：溪水是清清的，還是濁濁的？溪邊長了哪些植物？",
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "走到溪邊的時候，我們應該怎麼做？",
          options: ["靠近溪邊玩水", "跟著隊伍走，不靠近水邊", "把垃圾丟進溪裡"],
          answer: 1,
          why: "溪邊又滑又危險，要跟著隊伍走；也不能丟垃圾，讓小魚有乾淨的家。"
        },
        {
          type: "pick2",
          subject: "生活",
          title: "三玉的祕密",
          host: "kid",
          story: "三玉國小的名字，藏著兩個老地名！學校這一帶以前叫做「三角埔」，旁邊這條溪叫做「玉潮坑溪」。選出兩個地名，拼出「三玉」吧！",
          options: ["天母", "三角埔", "中山北路", "玉潮坑溪"],
          answer: [1, 3],
          parts: ["三", "玉"],
          result: "三玉國小",
          end: "三角埔的「三」，加上玉潮坑溪的「玉」，就是我們的三玉國小！"
        }
      ]
    },
    {
      id: "finish",
      name: "回到三玉國小",
      emoji: "✉️",
      kind: "school",
      noBuilding: true,
      at: 24,
      pos: [19.5, 23],
      tasks: [
        {
          type: "choice",
          subject: "生活",
          q: "複習：想寄一封信給住在遠方的奶奶，要去哪裡？",
          options: ["派出所", "郵局", "公園"],
          answer: 1,
          why: "寄信要到郵局。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "複習：想把紅包錢存起來，可以去哪裡？",
          options: ["銀行", "消防隊", "廟宇"],
          answer: 0,
          why: "銀行可以幫我們存錢。"
        },
        {
          type: "choice",
          subject: "生活",
          q: "複習：三玉國小的「三玉」，是從哪兩個地名來的？",
          options: ["天母和士林", "三角埔和玉潮坑溪", "三玉宮和玉山"],
          answer: 1,
          why: "三角埔的「三」，加上玉潮坑溪的「玉」，就是三玉。"
        },
        {
          type: "letter",
          subject: "國語",
          q: "寫一封感謝信，給今天認識的社區人物！",
          recipients: [
            { name: "郵差叔叔", icon: "post", lines: ["謝謝您每天幫大家送信和包裹。", "下雨天送信很辛苦，謝謝您。"] },
            { name: "警察阿姨", icon: "police", lines: ["謝謝您保護社區的安全。", "謝謝您在路口幫我們過馬路。"] },
            { name: "消防員叔叔", icon: "fire", lines: ["謝謝您不怕危險，幫大家救火。", "謝謝您隨時準備好幫助別人。"] },
            { name: "圖書館阿姨", icon: "library", lines: ["謝謝您幫我們找到好看的書。", "謝謝您把圖書館整理得好乾淨。"] },
            { name: "銀行叔叔", icon: "bank", lines: ["謝謝您幫大家把錢存好。", "謝謝您耐心的回答我們的問題。"] }
          ],
          greeting: "您好！",
          blessing: ["祝您", "平安快樂"]
        }
      ]
    }
  ]
};
