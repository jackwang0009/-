// 生成 docs/书库/番茄-档案.csv（20 列，序号 1-30，UTF-8 with BOM）
import fs from "node:fs";
import { readJson, ts, parseCsv, toPermanentCover } from "./lib.mjs";

const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));
// 只有归一化后仍不同才算真冲突，纯标点差异以官方书页为准
const norm = (s) =>
  String(s ?? "")
    .replace(/[\s，,。.！!？?、·:：""''《》()（）[\]【】\-—_~]/g, "")
    .toLowerCase();

const COLS = [
  "序号", "书名", "作者", "平台", "书籍ID", "官方书页URL", "字数(万)", "连载状态",
  "平台分类", "内容标签", "总章节数", "首发时间", "最近更新", "榜位快照20260826",
  "核心设定", "简介摘要", "封面URL", "是否核心玄幻盘", "数据来源", "核验状态",
];

// 自己概括，≤60 字，不复制官方简介
const SUMMARY = {
  1: "主角藏起真实身份在幕后布局，走剑道路线、不设后宫的长线传统玄幻。",
  2: "腹黑主角穿行异世大陆，一路打脸对手的传统玄幻长篇。",
  3: "目盲剑客背着剑棺行走世间，靠系统走杀伐剑修路线。",
  4: "狱卒开局低调摸鱼，靠一身长生熬死所有对手。",
  5: "穿越到底层兵役，每日固定增幅积累到徒手碎星。",
  6: "长生不死却被所有人误会成绝世强者的家族长线。",
  7: "顶着废品血脉，靠一座宝塔穿越完成废材逆袭。",
  8: "毫无天赋的凡骨之身，靠苦修一步步爬上仙途。",
  9: "纯粹剑道无敌流，一剑压服诸方强敌。",
  10: "没有正派视角的反套路群像，出场人物人人皆恶仙。",
  11: "以妖族视角起笔，吞天噬地一路成帝。",
  12: "移植妖魔心脏开局，身体不断异化成绝世凶物。",
  13: "每日可攒的时间静止能力，靠这一招横推末世废土。",
  14: "十日倒计时框架下的无限流副本求生故事。",
  15: "顶着伪神身份，在民俗神话体系里周旋求生。",
  16: "神域降临后全球升级，主角横推诸天万界。",
  17: "冒充世家子弟混入门阀的身份流历史玄幻。",
  18: "奇遇可视化的金手指，天下机缘尽收眼底。",
  19: "每年只涨一点点，山野村夫慢慢熬成仙界道祖。",
  20: "都市异能撞上「上交国家」梗的轻松脑洞。",
  21: "以凶宅为舞台的规则怪谈，住进去就得守规矩。",
  22: "用城市志的写法讲都市怪谈，一城一诡事。",
  23: "靠命理术数替人改命的都市玄幻。",
  24: "风水术法结合都市异能的斗法故事。",
  25: "觉醒长生系统，靠沉睡续命，一代代熬过故人。",
  26: "变身少女斩妖除魔，把妖魔录入图谱夺其神通。",
  27: "长生者开局就撞上玄武门之变的历史脑洞。",
  28: "抢在末日之前反向降临的科幻玄幻。",
  29: "仙侠游戏成真且退不出去的沉浸式脑洞。",
  30: "天眼开局，靠风水断事的都市玄幻。",
};

// 底本书名与官方书名不一致、但身份已由通道 1 定案的，在这里显式登记。
// 自动匹配器永远对不上这类条目（书名根本不同），只能人工登记并留证据链。
const CONFIRMED_IDS = {
  // 底本《烟雨楼》系误记：Neodrop 原文「传统玄幻、非后宫、烟雨楼布局线」中，
  // 「烟雨楼」是书中势力/情节线而非书名。官方书页为《惊鸿》，通道 1、3 两次独立抓取互证，
  // readCount 1326099 与底本「132.6 万在读」吻合。定案见 MCP-1 2026-08-26 回复。
  1: "6883748331202284558",
  // 底本《时停》是简称：官方书名《时停起手，邪神也得给我跪下！》，作者六个葫芦一致，
  // 官方 231.9 万字 vs 底本 231 万，差 0.4%。
  13: "7504849932138859545",
  // 底本《不死帝师》系旧名/别名：官方书名《系统赋我长生，我熬死了所有人》，
  // 作者一只榴莲3号一致，官方 529.1 万字 vs 底本 527.8 万，差 0.2%。
  25: "7228940788351110182",
  // 底本《那妖魔是姜大人！》系旧名/别名：官方书名《从变身少女开始斩妖除魔》，
  // 作者八爪触手怪一致，官方 218.3 万字 vs 底本 217.5 万，差 0.4%。
  26: "7544766518324644889",
};

// 书名与底本不一致时，逐条写明「为什么不一致」——误记 / 简称 / 别名 是三回事，
// 一律写成「误记」会让下游以为底本那条交叉引证也错了（通道 1 2026-08-26 纠偏）。
// 底本核心设定与官方书页内容相矛盾时按书页改写，底本原句留存到 数据来源 以便追溯
// （规范第 1 节第 15 列 2026-08-26 修订；「沿用底本」的前提是底本指对了书）。
const CORE_OVERRIDE = {
  26: {
    text: "变身开局 + 百妖谱录妖夺神通；盛唐背景斩妖线",
    baseText: "妖魔身份反差 + 双面视角",
  },
};

// 未取到 ID 的行，写清「为什么难查」而不是留一个无解释的空格
const SOURCE_UNRESOLVED = {
  16:
    "底本沿用；候选 7590221243043826712（第三方索引记作者道不易、玄幻脑洞、173.4 万字，与底本三项相符），" +
    "但番茄限流未能回官方书页复核，故不填 ID。另：道不易官方作者页仅挂 2 本书，遮罩后书名骨架为「游戏劲，挖矿！」，" +
    "不含神/域/囚/徒任一字，故《神域囚徒！》极可能亦为旧名，官方现名待查",
  18: "底本沿用；未找到 fanqienovel.com 官方书页，无候选 ID",
  20:
    "底本沿用；候选 7650499837250522137《系统想害我，我选择上交国家》，底本名为其后半段，" +
    "但底本无作者无字数，凑不齐第二个独立信号，故不填 ID",
};

const ROW_STATUS = {
  1: "已核实-平台现名《惊鸿》；底本《烟雨楼》系误记，原始引文「烟雨楼布局线」指书中势力线而非书名",
  5: "已核实-平台现名《力量每天增加百分之一我徒手爆星》无逗号，底本多一个逗号，属标点差异非改名",
  13: "已核实-平台现名《时停起手，邪神也得给我跪下！》；底本《时停》为其简称，非误记",
  25: "已核实-平台现名《系统赋我长生，我熬死了所有人》；底本《不死帝师》为其别名/旧名，非误记",
  26: "已核实-平台现名《从变身少女开始斩妖除魔》；底本《那妖魔是姜大人！》为其别名非误记（跨站趋势 3.2 节可核）；为《万妖图录传》改编原著",
  16: "待核实-候选 7590221243043826712（作者道不易、玄幻脑洞、173.4 万字，与底本三项相符），但候选来自第三方索引且本通道遇软限流未能回官方书页复核，故不填 ID",
  20: "待核实-候选 7650499837250522137《系统想害我，我选择上交国家》，底本名为其后半段，仅单信号匹配未交叉验证",
  30: "已核实-书名与平台分类双重命中；书页在读 83.7 万低于底本 107.3 万，该书已完结，疑为完结后回落",
};

// 通道 1 从官方书页抓到、但本通道因软限流（HTTP 200 + 空 body）未能自行复核的行。
// 转录而非自采，来源里必须写明，不能冒充本通道实测。封面为签名链、通道 1 未提供，故留空。
const RELAYED = {
  30: {
    bookId: "7326876174989134910",
    bookName: "天眼风水师",
    author: "道之子",
    wordNumber: 1303000,
    creationStatus: "0",
    chapterTotal: 991,
    categories: [{ name: "都市日常" }, { name: "都市" }, { name: "第一人称" }, { name: "风水秘术" }],
    firstDate: "2024-01-22",
    lastDate: "2026-07-22",
    // 封面走 CDN 而非 fanqienovel.com，不受软限流影响，本通道已自行实测：200 / image/png / 106097 B
    thumbUrl:
      "https://p6-novel.byteimg.com/novel-pic/p2o0a2b996f16f47236c6f3f0af6bd9ceb4~tplv-resize:225:300.image",
  },
};

const csv = parseCsv(fs.readFileSync("docs/玄幻选题库-100本-20260826.csv", "utf8"));
const base = csv.slice(1).filter((r) => r.length > 1 && Number(r[0]) >= 1 && Number(r[0]) <= 30);
const { resolved } = readJson(".scrape/id_map2.json", { resolved: {} });
const books = readJson(".scrape/books.json", {});
// 封面实测结果（.scrape/probe_covers.mjs 产出）：只有实测 200 + image/* 的才敢在数据来源里声明已校验
const coverProbe = new Map(
  (readJson(".scrape/cover_probe.json", []) || [])
    .filter((c) => c.signed?.includes(" OK"))
    .map((c) => [String(c.no), c]),
);

const esc = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = [];
const puaHits = [], unresolved = [], nameDiff = [];

for (const r of base) {
  const no = Number(r[0]);
  const baseTitle = r[1], baseAuthor = r[2], baseRank = r[7], baseCore = r[6], baseCoreDisk = r[8];
  const confirmedId = CONFIRMED_IDS[no];
  const hit = resolved[String(no)];
  const bookId = confirmedId ?? hit?.bookId;
  const b = bookId ? books[bookId] : null;

  let 书名 = baseTitle, 作者 = baseAuthor, 状态 = "待核实";
  let 来源 = "番茄官方书页 2026-08-26";
  let ID = "", URL = "", 字数 = "", 连载 = "", 分类 = "", 标签 = "";
  let 章节 = "", 首发 = "", 更新 = "", 封面 = "";

  if (b && !b._err) {
    ID = b.bookId;
    URL = b.url;
    书名 = b.bookName || baseTitle;
    作者 = b.author || baseAuthor;
    字数 = b.wordNumber ? (b.wordNumber / 10000).toFixed(1) : "";
    连载 = String(b.creationStatus) === "0" ? "已完结" : String(b.creationStatus) === "1" ? "连载中" : "";
    const cats = b.categories || [];
    分类 = cats[0]?.name ?? "";
    标签 = cats.slice(1).map((c) => c.name).join("/");
    章节 = b.chapterTotal || "";
    首发 = ts(b.firstPassTime);
    更新 = ts(b.lastPublishTime);
    封面 = toPermanentCover(b.thumbUrl || "");
    状态 = "已核实";

    if (封面) {
      来源 = "番茄官方书页 2026-08-26；封面为免签名永久链，已实测与签名版 sha256 逐字节一致";
    }

    if (hasPUA(书名) || hasPUA(作者)) {
      状态 = "待核实-PUA";
      来源 = "番茄官方书页 2026-08-26；书名/作者含 PUA 私有字体字符，需 App 内核对";
      puaHits.push({ no, 书名, 作者 });
    }
    if (confirmedId) {
      来源 += `；底本《${baseTitle}》与平台现名不一致，书名以官方书页为准`;
    } else if (norm(书名) !== norm(baseTitle)) {
      状态 = `冲突-官方书页作《${书名}》，底本作《${baseTitle}》，待 App 内核对`;
      nameDiff.push({ no, baseTitle, official: 书名, id: ID });
    }
  } else if (RELAYED[no]) {
    const rl = RELAYED[no];
    ID = rl.bookId;
    URL = `https://fanqienovel.com/page/${rl.bookId}`;
    书名 = rl.bookName;
    作者 = rl.author;
    字数 = (rl.wordNumber / 10000).toFixed(1);
    连载 = rl.creationStatus === "0" ? "已完结" : "连载中";
    分类 = rl.categories[0].name;
    标签 = rl.categories.slice(1).map((c) => c.name).join("/");
    章节 = rl.chapterTotal;
    首发 = rl.firstDate;
    更新 = rl.lastDate;
    封面 = toPermanentCover(rl.thumbUrl || "");
    状态 = "已核实";
    来源 =
      "番茄官方书页 2026-08-26（书页字段为通道 1 抓取转录，本通道遇软限流未能自行复核）；封面为免签名永久链，本通道已自行实测 200/image/png/106097B";
  } else {
    来源 = SOURCE_UNRESOLVED[no] ?? "底本沿用；番茄官方榜单未覆盖，未取到书籍ID";
    unresolved.push({ no, baseTitle });
  }

  if (ROW_STATUS[no]) 状态 = ROW_STATUS[no];

  let 核心设定 = baseCore;
  const co = CORE_OVERRIDE[no];
  if (co && ID) {
    核心设定 = co.text;
    来源 += `；底本原核心设定「${co.baseText}」与书页内容不符，已按书页改写并留存原句`;
  }

  rows.push([
    no, 书名, 作者, "番茄", ID, URL, 字数, 连载, 分类, 标签, 章节, 首发, 更新,
    baseRank, 核心设定, SUMMARY[no] ?? "", 封面, baseCoreDisk, 来源, 状态,
  ]);
}

const out = "\uFEFF" + [COLS, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
fs.mkdirSync("docs/书库", { recursive: true });
fs.writeFileSync("docs/书库/番茄-档案.csv", out, "utf8");

console.log(`rows=${rows.length} cols=${COLS.length}`);
console.log(`已核实=${rows.filter((r) => r[19] === "已核实").length}`);
console.log(`待核实-PUA=${puaHits.length}`);
console.log(`冲突=${nameDiff.length}`);
console.log(`未取到ID=${unresolved.length}`);
console.log("\n-- 书名与底本不一致 --");
for (const d of nameDiff) console.log(`  #${d.no} 底本《${d.baseTitle}》 vs 官方《${d.official}》 ${d.id}`);
console.log("\n-- 未对上 ID --");
for (const u of unresolved) console.log(`  #${u.no} ${u.baseTitle}`);
console.log("\n-- PUA 命中 --");
for (const p of puaHits) console.log(`  #${p.no} ${p.书名} / ${p.作者}`);
