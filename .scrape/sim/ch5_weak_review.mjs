// 通道 5 接管（原属通道 5，已不干活；本轮由通道 3 接管执行）·SCHEMA 修订 6 弱词词义复核。
// 弱词四个：重开 / 沙盘 / 演算 / 预演。上一轮通道 5 只复核了「重开」（判据落在
// ch5_chongkai_verdict.json，剔 18 留 11），沙盘/演算/预演三个词一次都没做过。
//
// 本脚本只做取证：把「仅靠弱词入选」的书连同命中处原句列出来，供逐本回原句判词义。
// 判定本身写在 ch5_weak_verdict.json（人做的判断，留成可审的数据文件，不藏进正则）。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const data = readJson(path.join(DIR, "raw_ch5_feilu.json"));

const WEAK = ["重开", "沙盘", "演算", "预演"];
const STRONG = ["模拟器", "人生模拟", "模拟", "推演"]; // 有其一兜底，弱词判假也不影响入选

const hasWeak = (b) => (b.simEvidence?.keywords ?? []).filter((k) => WEAK.includes(k));
const hasStrong = (b) => (b.simEvidence?.keywords ?? []).filter((k) => STRONG.includes(k));

const weakBooks = data.books.filter((b) => hasWeak(b).length);
const weakOnly = weakBooks.filter((b) => !hasStrong(b).length);
const backed = weakBooks.filter((b) => hasStrong(b).length);

console.log(`books ${data.books.length}｜含弱词 ${weakBooks.length}｜仅靠弱词入选 ${weakOnly.length}｜有强词兜底 ${backed.length}`);
const cnt = {};
for (const b of weakOnly) for (const k of hasWeak(b)) cnt[k] = (cnt[k] ?? 0) + 1;
console.log(`仅靠弱词的按词分布：${JSON.stringify(cnt)}`);
console.log(`有强词兜底的（不参与降级）：${backed.map((b) => b.title).join("、")}`);

// 命中处上下文：整句优先，取不到就前后各 45 字
const sentenceAround = (text, kw) => {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const i = t.indexOf(kw);
  if (i < 0) return null;
  const left = Math.max(...["。", "！", "？", "；", "】", "…"].map((p) => t.lastIndexOf(p, i)));
  const rightCands = ["。", "！", "？", "；", "【"].map((p) => t.indexOf(p, i + kw.length)).filter((x) => x > 0);
  const right = rightCands.length ? Math.min(...rightCands) : -1;
  const s = t.slice(left >= 0 ? left + 1 : Math.max(0, i - 45), right >= 0 ? right + 1 : Math.min(t.length, i + kw.length + 45));
  return s.trim();
};

console.log("\n================ 仅靠弱词入选，逐本原句 ================");
for (const [n, b] of weakOnly.entries()) {
  const kws = hasWeak(b);
  console.log(`\n[${n + 1}] ${b.title} — ${b.author}｜${b.platform}｜${(b.wordCount / 10000).toFixed(1)}万｜${b.status}`);
  console.log(`    弱词 ${kws.join("/")}｜matchedIn ${(b.simEvidence?.matchedIn ?? []).join("+")}｜分类 ${(b.categories ?? []).join("/")}｜标签 ${(b.tags ?? []).join("/")}`);
  for (const k of kws) {
    const inTitle = b.title.includes(k);
    const s = sentenceAround(b.abstract, k);
    if (inTitle) console.log(`    「${k}」@书名`);
    if (s) console.log(`    「${k}」@简介：${s}`);
    if (!inTitle && !s) console.log(`    「${k}」@标签/分类（简介里没有）`);
  }
}
