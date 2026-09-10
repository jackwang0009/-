// 交付统计 + 一条假阳性审计。纯离线。
// 审计的由来：条件B 的简介词表里「大道」是宽词，「大道理」「大道上」都含它。
// 主池靠分类就满足 B，这个风险被掩盖了；补池（非修仙分类）的书只能靠简介词成立 B，
// 风险在那一侧才会暴露出来，所以这里专门把「仅靠简介词入选」的书逐条摊开看。
import { readJson } from "../lib.mjs";

const CULT_KW = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道"];
const d = readJson(".scrape/sim/raw_ch2_fanqie.json");
const info = readJson(".scrape/sim/ch2_info.json", {});
const infoNon = readJson(".scrape/sim/ch2_info_noncult.json", {});
const all = { ...infoNon, ...info };

const byId = Object.fromEntries(d.books.map((b) => [b.platformBookId, b]));

console.log(`books=${d.books.length}  nearMiss=${d.nearMiss.length}  meta.status=${d.meta.status}`);

// ---- 头部样本 ----
console.log(`\n--- 在读量前 12 ---`);
d.books.slice(0, 12).forEach((b, i) => {
  console.log(
    `${String(i + 1).padStart(2)}. ${b.title}  |  ${(b.wordCount / 10000).toFixed(0)}万字 ${b.chapterTotal ?? "?"}章 ${b.status}` +
    `  |  在读 ${(b.popularity.raw / 10000).toFixed(0)}万  |  ${b.simEvidence.matchedIn.join("+")} ${b.simEvidence.keywords.join("/")}` +
    `  |  ${(b.categories ?? []).join("/")}`
  );
});

// ---- 字数分布与离群值 ----
const wc = d.books.map((b) => b.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
const q = (p) => wc[Math.min(wc.length - 1, Math.floor(wc.length * p))];
console.log(`\n--- 字数分位（本） ---`);
console.log(`   p10 ${q(0.1)}  p25 ${q(0.25)}  中位 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  最大 ${wc.at(-1)}`);
console.log(`   最长三本：`);
[...d.books].sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0)).slice(0, 3)
  .forEach((b) => console.log(`     ${b.title} ${(b.wordCount / 10000).toFixed(1)}万字 / ${b.chapterTotal ?? "?"}章 → 每章约 ${b.chapterTotal ? Math.round(b.wordCount / b.chapterTotal) : "?"} 字`));

// ---- 假阳性审计：仅靠简介词满足条件B 的书 ----
console.log(`\n--- 条件B 仅靠简介词成立的书（分类不属仙侠/玄幻系）---`);
let n = 0;
for (const b of d.books) {
  const r = all[b.platformBookId];
  if (!r?._judge || r._judge.catCult) continue;
  n++;
  const hits = CULT_KW.filter((k) => String(r.abstract ?? "").includes(k));
  const ctx = hits.map((k) => {
    const i = String(r.abstract).indexOf(k);
    return `「…${String(r.abstract).slice(Math.max(0, i - 8), i + k.length + 8)}…」`;
  });
  console.log(`  ${n}. ${b.title}  cats=${(r._judge.cats ?? []).join("/")}`);
  console.log(`     修仙词 ${hits.join("/")}  上下文 ${ctx.join(" ")}`);
  const onlyBroad = hits.length === 1 && hits[0] === "大道";
  if (onlyBroad) console.log(`     ⚠ 只靠「大道」一个宽词成立，需人工判断是不是「大道理/大道上」误伤`);
}
if (!n) console.log(`  （无）`);

// ---- nearMiss 形状 ----
if (d.nearMiss.length) {
  console.log(`\n--- nearMiss 命中词分布 ---`);
  const kw = {};
  for (const nm of d.nearMiss) {
    const r = all[String(nm.url).split("/").pop()];
    (r?._judge?.keywords ?? []).forEach((k) => (kw[k] = (kw[k] ?? 0) + 1));
  }
  console.log(`   ${JSON.stringify(kw)}`);
  const cats = {};
  for (const nm of d.nearMiss) {
    const r = all[String(nm.url).split("/").pop()];
    (r?._judge?.cats ?? []).forEach((c) => (cats[c] = (cats[c] ?? 0) + 1));
  }
  console.log(`   分类分布（前 12）${JSON.stringify(Object.fromEntries(Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 12)))}`);
}
