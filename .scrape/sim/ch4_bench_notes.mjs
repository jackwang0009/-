// 接手通道 4 · 把 86 vs 92 的对账结论写进 raw_ch4_qimao.json 的 meta.notes。
// 授权范围只有 meta.notes 这一项：books 与 nearMiss 一字不动，写回前后逐字校验，不一致就中止。
// 采用追加而不是改写——原 notes 是通道 4 写的，我只补一段署名附注，不动它已有的句子。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const FILE = path.join(DIR, "raw_ch4_qimao.json");
const raw = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(raw);

const before = JSON.stringify({ books: data.books, nearMiss: data.nearMiss });

const ADD =
  "\n【86 vs 92 对账·由接手通道 4 的通道 3 补记，2026-09-09】两个数都对，口径不同，**交付本数就是 92**。" +
  "逐条回查命中池 ch4_qm_hits.json 的 _hitBy：92 本里有 6 本只被 rev: 前缀（第三轮反向召回）的关键词命中，" +
  "92−6=86 正是前两轮口径下的本数。这 6 本是《金丹是恒星，你管这叫修仙？》《从捡修为开始，打造极道世家》" +
  "《合欢宗：三年杂役，苟成盖世魔头》《我都金丹了，你告诉我要参加武道高考？》《趋吉避凶：宗门卜卦百年，成就无上仙帝》" +
  "《凡人修仙：从造化万物开始》，全部为 matchedIn=abstract（仅简介命中），与本 notes 上文「该亚群 5→11」的说法一致。" +
  "\n【连带定死两个引用口径】① **模拟词入书名 = 88%（81/92）**，不是 94%：matchedIn 分布为 abstract+title 72 / abstract 11 / title 9，" +
  "带书名命中的是 72+9=81；94% 是 81/86 的旧分母，第三轮新增的 6 本全是仅简介命中，只进分母不进分子。" +
  "② **字数中位数 = 656900 字**，写成「65.9 万」是把 65.69 万四舍五入错了一位，成稿引用请用 656900 或 65.7 万。" +
  "\n【提请通道 1 核一句】本 notes 上文「实测该截断把中位数从 656900 抬到 656900（虚高约 0%）」两个数相同、" +
  "结论却是「虚高」，疑为通道 4 改稿时漏改前一个数。我没有权限改写它已有的句子，只在此标注。" +
  "复现：node .scrape/sim/ch4_bench_reconcile.mjs";

if (data.meta.notes.includes("86 vs 92 对账")) {
  console.log("已写过，跳过（幂等）");
} else {
  data.meta.notes += ADD;
  const out = JSON.stringify(data, null, 2);
  fs.writeFileSync(FILE, out, "utf8");
  const after = JSON.stringify({ books: JSON.parse(out).books, nearMiss: JSON.parse(out).nearMiss });
  if (after !== before) {
    fs.writeFileSync(FILE, raw, "utf8");
    console.error("✗ books/nearMiss 发生变化，已回滚到原文件");
    process.exit(1);
  }
  console.log(`✓ 只追加了 meta.notes（+${ADD.length} 字），books ${data.books.length} 本 / nearMiss ${data.nearMiss.length} 条逐字未变`);
}
