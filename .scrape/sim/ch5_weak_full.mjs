// 通道 5 接管 · 弱词复核取证第二步：上一步靠单句判不了的，整段简介打出来。
// 飞卢简介普遍以「【飞卢小说网独家签约小说：书名】」开头，那一句是模板不是内容，
// 句子级抽取会正好抓到它，看着像有上下文其实什么都没说——这类必须看全文再判。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const data = readJson(path.join(DIR, "raw_ch5_feilu.json"));
const WEAK = ["重开", "沙盘", "演算", "预演"];
const STRONG = ["模拟器", "人生模拟", "模拟", "推演"];
const weakOnly = data.books.filter(
  (b) => (b.simEvidence?.keywords ?? []).some((k) => WEAK.includes(k)) && !(b.simEvidence?.keywords ?? []).some((k) => STRONG.includes(k)),
);

const want = process.argv.slice(2).map(Number);
for (const [i, b] of weakOnly.entries()) {
  if (want.length && !want.includes(i + 1)) continue;
  console.log(`\n===== [${i + 1}] ${b.title} — ${b.author}｜${b.platform}｜${(b.wordCount / 10000).toFixed(1)}万`);
  console.log(`标签 ${(b.tags ?? []).join("/")}`);
  console.log((b.abstract ?? "").replace(/\s+/g, " "));
}
