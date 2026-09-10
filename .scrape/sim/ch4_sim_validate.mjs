// 通道 4 / 阶段 3：交付前自检。逐条比对 SCHEMA 第二节的字段契约，任何不合规都打出来。
import { readJson } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

const FIELDS = [
  "platform", "platformBookId", "title", "author", "url", "wordCount", "chapterTotal",
  "status", "categories", "tags", "abstract", "popularity", "score", "firstPublishDate",
  "lastUpdateDate", "simEvidence", "openingHook", "collectedAt", "source",
];

const d = readJson(".scrape/sim/raw_ch4_qimao.json");
const problems = [];
const push = (i, m) => problems.push(`  #${i} ${m}`);

log(`\n===== ch4 validate @ ${new Date().toISOString()} =====`);
log(`meta.channel=${d.meta.channel} platforms=${JSON.stringify(d.meta.platforms)}`);
log(`books=${d.books.length} nearMiss=${d.nearMiss.length}`);

// ---- 顶层结构 ----
for (const k of ["meta", "books", "nearMiss"]) if (!(k in d)) problems.push(`  顶层缺 ${k}`);
for (const k of ["channel", "platforms", "status", "collectedAt", "entryPoints", "notes"])
  if (!(k in d.meta)) problems.push(`  meta 缺 ${k}`);
// SCHEMA 修订 3 新增的正式字段，合并脚本靠它区分「阻断」与「没开工」
if (!["ok", "partial", "blocked-by-policy"].includes(d.meta.status))
  problems.push(`  meta.status 非法：${d.meta.status}`);

const ids = new Set();
d.books.forEach((b, i) => {
  // 字段名严格照抄，不多不少
  const got = Object.keys(b);
  const missing = FIELDS.filter((f) => !got.includes(f));
  const extra = got.filter((f) => !FIELDS.includes(f));
  if (missing.length) push(i, `缺字段 ${missing.join(",")}`);
  if (extra.length) push(i, `多出字段 ${extra.join(",")}`);

  if (b.platform !== "qimao" && b.platform !== "zhihu") push(i, `platform 非法：${b.platform}`);
  if (!b.title) push(i, `title 空`);
  if (!/^https?:\/\//.test(b.url ?? "")) push(i, `url 非法：${b.url}`);
  if (ids.has(b.platformBookId)) push(i, `platformBookId 重复：${b.platformBookId}`);
  ids.add(b.platformBookId);

  // 数值口径：wordCount 必须是整数「字」，不能残留字符串
  if (b.wordCount !== null && (!Number.isInteger(b.wordCount) || b.wordCount <= 0))
    push(i, `wordCount 非正整数：${JSON.stringify(b.wordCount)}`);
  if (b.chapterTotal !== null && !Number.isInteger(b.chapterTotal))
    push(i, `chapterTotal 非整数：${JSON.stringify(b.chapterTotal)}`);

  if (!["连载", "完结", "unknown"].includes(b.status)) push(i, `status 非法：${b.status}`);

  for (const [f, v] of [["categories", b.categories], ["tags", b.tags]])
    if (v !== null && !Array.isArray(v)) push(i, `${f} 既非 null 也非数组`);

  for (const f of ["firstPublishDate", "lastUpdateDate"])
    if (b[f] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(b[f])) push(i, `${f} 非 YYYY-MM-DD：${b[f]}`);

  // simEvidence.matchedIn 不许留空
  const se = b.simEvidence;
  if (!se || !Array.isArray(se.matchedIn) || !se.matchedIn.length) push(i, `simEvidence.matchedIn 为空`);
  else {
    const bad = se.matchedIn.filter((m) => !["title", "tag", "abstract"].includes(m));
    if (bad.length) push(i, `matchedIn 含非法值 ${bad.join(",")}`);
    // 判据留痕必须真的对得上原文
    for (const m of se.matchedIn) {
      const hay = m === "title" ? b.title : m === "abstract" ? b.abstract ?? "" : "";
      if (hay && !se.keywords.some((k) => hay.includes(k)))
        push(i, `matchedIn 声称命中 ${m}，但原文里找不到任一 keyword：${b.title}`);
    }
  }
  if (!se?.keywords?.length) push(i, `simEvidence.keywords 为空`);

  if (b.popularity !== null && (typeof b.popularity !== "object" || !("metric" in b.popularity)))
    push(i, `popularity 结构非法`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(b.collectedAt ?? "")) push(i, `collectedAt 非 ISO：${b.collectedAt}`);
});

d.nearMiss.forEach((n, i) => {
  for (const k of ["title", "url", "reason"]) if (!n[k]) problems.push(`  nearMiss#${i} 缺 ${k}`);
});

// ---- 统计 ----
const wc = d.books.map((b) => b.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
const med = wc.length % 2 ? wc[(wc.length - 1) / 2] : Math.round((wc[wc.length / 2 - 1] + wc[wc.length / 2]) / 2);
const fill = (f) => d.books.filter((b) => b[f] !== null && b[f] !== undefined).length;

log(`\n--- 字段填充率（${d.books.length} 本）---`);
for (const f of FIELDS) log(`   ${f.padEnd(16)} ${String(fill(f)).padStart(3)}/${d.books.length}`);

log(`\n--- 数值 ---`);
log(`   字数中位数 ${med}（${(med / 10000).toFixed(1)} 万字）  最小 ${(wc[0] / 10000).toFixed(1)}万  最大 ${(wc.at(-1) / 10000).toFixed(1)}万`);
const st = {};
d.books.forEach((b) => (st[b.status] = (st[b.status] ?? 0) + 1));
log(`   状态分布 ${JSON.stringify(st, null, 0)}`);
const mi = {};
d.books.forEach((b) => { const k = b.simEvidence.matchedIn.join("+"); mi[k] = (mi[k] ?? 0) + 1; });
log(`   matchedIn 分布 ${JSON.stringify(mi, null, 0)}`);
const cats = {};
d.books.forEach((b) => (b.categories ?? []).forEach((c) => (cats[c] = (cats[c] ?? 0) + 1)));
log(`   分类分布 ${JSON.stringify(cats, null, 0)}`);

log(`\n--- 结论 ---`);
if (problems.length) {
  log(`❌ ${problems.length} 处不合规：`);
  problems.slice(0, 40).forEach((p) => log(p));
} else {
  log(`✅ 全部 ${d.books.length} 条 books + ${d.nearMiss.length} 条 nearMiss 均符合 SCHEMA 第二节字段契约`);
}
log(`===== validate done =====`);
