/*
 * 社區踏查地圖：資料範本
 * ------------------------------------------------------------
 * 用法：把「OO」換成你們的學校與地點，題目換成你們的。
 *   - 給 Claude 做單一 HTML 版：把 window.TOUR 改成 var DATA，貼在提示詞最後。
 *   - 沿用本專案：把這個檔案存成 data/tour.js 覆蓋原本的檔案。
 *
 * 座標怎麼估：
 *   1. 截一張 Google 地圖，學校放在右下角附近。
 *   2. 把截圖想成 x 從 -30（左）到 30（右）、z 從 -35（上）到 30（下）的方格。
 *   3. 路線點 route 沿著真的馬路取，轉彎處多放一個點。
 *   4. 站點 pos 是建築的位置，放在路線點旁邊 4～6 格，不要壓在路上。
 *
 * 小遊戲角色（host）可用：kid、police、postman、banker、firefighter、librarian
 * 數學圖示（item）可用：orange、coin、book、drop、helmet、leaf、flower
 *
 * 數學題的數字都寫「假設」，不是真實資料。
 * 不要放學生姓名、照片、班級。
 */
window.TOUR = {
  title: "OO社區踏查",
  subtitle: "二年級・生活 × 數學 × 國語",

  center: { name: "OO", note: "以前的地名", tip: "這裡以前叫做「OO」！" },

  // 沒有溪流就刪掉這一行
  river: [[0, -20], [2, 0], [4, 20]],

  route: [
    [20, 25], // 0 學校（出發）
    [0, 25],
    [-15, 20], // 2 第一站
    [-15, 0],
    [-10, -20], // 4 第二站
    [5, -10],
    [10, 10],
    [20, 25] // 7 回到學校
  ],

  stations: [
    {
      id: "start",
      name: "OO國小",
      emoji: "🏫",
      kind: "school",
      at: 0,
      pos: [22, 12],
      rot: 0,
      lookFor: "出發前檢查：帽子戴好了嗎？水壺帶了嗎？",
      tasks: [
        { type: "info", text: "今天我們要從學校出發，走一圈社區，最後回到學校寫一封信！" },
        {
          type: "choice",
          subject: "生活",
          q: "走在社區的路上，我們應該怎麼做？",
          options: ["走人行道，跟著隊伍走", "邊走邊玩追來追去", "自己先跑到最前面"],
          answer: 0,
          why: "走人行道、跟緊隊伍，大家才安全。"
        }
      ]
    },
    {
      id: "post",
      name: "OO郵局",
      emoji: "📮",
      kind: "post",
      at: 2,
      pos: [-20, 17],
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
          type: "math",
          subject: "數學",
          story: "假設一張郵票要六元，小明要買三張。",
          item: "coin",
          per: 6,
          groups: 3,
          unit: "元",
          ask: "一共要付幾元？"
        },
        {
          type: "order",
          subject: "國語",
          q: "把詞語排成通順的句子！",
          hint: "先唸唸看：是誰？在什麼時候？做什麼事？",
          items: [{ text: "郵差叔叔" }, { text: "每天早上" }, { text: "把信" }, { text: "送到我家。" }]
        }
      ]
    },
    {
      id: "library",
      name: "OO圖書館",
      emoji: "📚",
      kind: "library",
      at: 4,
      pos: [-14, -25],
      lookFor: "到現場找找看：圖書館外面有沒有還書箱？",
      tasks: [
        {
          type: "sort",
          subject: "生活",
          title: "幫館員整理規則",
          story: "幫館員把這些事情分成「可以做」和「不可以做」吧！",
          host: "librarian",
          bins: [
            { name: "可以做", art: "signOk" },
            { name: "不可以做", art: "signNo" }
          ],
          items: [
            { text: "安靜的看書", bin: 0 },
            { text: "大聲聊天", bin: 1 },
            { text: "排隊借書", bin: 0 },
            { text: "在書上亂畫", bin: 1 }
          ]
        }
      ]
    },
    {
      id: "finish",
      name: "回到OO國小",
      emoji: "✉️",
      kind: "school",
      noBuilding: true,
      at: 7,
      pos: [18, 22],
      tasks: [
        {
          type: "letter",
          subject: "國語",
          q: "寫一封感謝信，給今天認識的社區人物！",
          recipients: [
            { name: "郵差叔叔", icon: "post", lines: ["謝謝您每天幫大家送信和包裹。", "下雨天送信很辛苦，謝謝您。"] },
            { name: "圖書館阿姨", icon: "library", lines: ["謝謝您幫我們找到好看的書。", "謝謝您把圖書館整理得好乾淨。"] }
          ],
          greeting: "您好！",
          blessing: ["祝您", "平安快樂"]
        }
      ]
    }
  ]
};
