import fs from "node:fs";

const parse = (line) => {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

const raw = fs.readFileSync("docs/书库/玄幻书库-100本.csv", "utf8").replace(/^\uFEFF/, "");
const rows = raw.split(/\r?\n/).filter((x) => x.trim()).slice(1).map(parse);

// 列：0序号 1书名 2作者 3平台 6字数 7状态 8平台分类 9内容标签 14核心设定
const words = rows.map((r) => Number(r[6])).filter((n) => n > 0).sort((a, b) => a - b);
const med = words[Math.floor(words.length / 2)];
console.log(`字数样本 ${words.length} 本：中位 ${med} 万，最小 ${words[0]}，最大 ${words[words.length - 1]}`);
const buckets = { "<100万": 0, "100-300万": 0, "300-600万": 0, "600万+": 0 };
for (const w of words) {
  if (w < 100) buckets["<100万"]++;
  else if (w < 300) buckets["100-300万"]++;
  else if (w < 600) buckets["300-600万"]++;
  else buckets["600万+"]++;
}
console.log("字数分布:", JSON.stringify(buckets));

const done = rows.filter((r) => r[7] === "已完结").length;
const going = rows.filter((r) => r[7] === "连载中").length;
console.log(`\n连载中 ${going} / 已完结 ${done} / 未知 ${100 - going - done}`);

// 核心设定 + 内容标签里的套路关键词命中
const text = rows.map((r) => `${r[1]} ${r[9]} ${r[14]}`).join(" ");
const kw = {
  "系统/面板/词条": /系统|面板|词条|属性|加点/g,
  "长生/不死": /长生|不死|熬死|百世/g,
  "苟/稳健": /苟|稳健|摸鱼|低调/g,
  "废材逆袭": /废材|废物|废灵根|逆袭/g,
  "无敌/横推": /无敌|横推|一拳|碾压/g,
  "穿越/重生": /穿越|重生|魂穿|转生/g,
  "民俗/灵异": /民俗|灵异|出马仙|风水|鬼|钟馗|赶尸/g,
  "同人/衍生": /同人|衍生|凡人|玄鉴|诸天/g,
  "御兽/宠物": /御兽|养兽|宠物|妖宠/g,
  "反套路/前置爽点": /反套路|开局就|已无敌|金手指来了|出身即/g,
};
console.log("\n套路关键词命中（100 本的书名+标签+核心设定）：");
for (const [k, re] of Object.entries(kw)) {
  const n = rows.filter((r) => re.test(`${r[1]} ${r[9]} ${r[14]}`)).length;
  console.log(`  ${k.padEnd(16)} ${n} 本`);
}
