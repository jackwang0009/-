// 通道 2 交付前自检：逐条比对 SCHEMA 第二节的字段契约，任何不合规都打出来。
// 做法参照通道 4 的 ch4_sim_validate.mjs，番茄侧另加两条本站特有的断言：
//   ① matchedIn 不可能含 tag（番茄 260 个分类节点里没有模拟类标签，见 meta.notes）
//   ② 文本字段不许残留 PUA 私有码位（列表接口的字体混淆若混进交付，是不报错的那类失败）
import { readJson } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch2.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

const FIELDS = [
  "platform", "platformBookId", "title", "author", "url", "wordCount", "chapterTotal",
  "status", "categories", "tags", "abstract", "popularity", "score", "firstPublishDate",
  "lastUpdateDate", "simEvidence", "openingHook", "collectedAt", "source",
];
const PUA = /[\uE000-\uF8FF]/;

const d = readJson(".scrape/sim/raw_ch2_fanqie.json");
const problems = [];
const push = (i, m) => problems.push(`  #${i} ${m}`);

log(`\n===== ch2 validate @ ${new Date().toISOString()} =====`);
log(`meta.channel=${d.meta.channel} platforms=${JSON.stringify(d.meta.platforms)} status=${d.meta.status}`);
log(`books=${d.books.length} nearMiss=${d.nearMiss.length}`);

// ---- 顶层结构 ----
for (const k of ["meta", "books", "nearMiss"]) if (!(k in d)) problems.push(`  顶层缺 ${k}`);
for (const k of ["channel", "platforms", "status", "collectedAt", "entryPoints", "notes"])
  if (!(k in d.meta)) problems.push(`  meta 缺 ${k}`);
if (!["ok", "partial", "blocked-by-policy"].includes(d.meta.status))
  problems.push(`  meta.status 非法：${d.meta.status}`);
if (d.meta.channel !== 2) problems.push(`  meta.channel 应为 2，实为 ${d.meta.channel}`);

const ids = new Set();
d.books.forEach((b, i) => {
  const got = Object.keys(b);
  const missing = FIELDS.filter((f) => !got.includes(f));
  const extra = got.filter((f) => !FIELDS.includes(f));
  if (missing.length) push(i, `缺字段 ${missing.join(",")}`);
  if (extra.length) push(i, `多出字段 ${extra.join(",")}`);

  if (b.platform !== "fanqie") push(i, `platform 非法：${b.platform}`);
  if (!b.title) push(i, `title 空`);
  if (!/^https:\/\/fanqienovel\.com\/page\/\d+$/.test(b.url ?? "")) push(i, `url 非法：${b.url}`);
  if (String(b.platformBookId ?? "") === "") push(i, `platformBookId 空`);
  if (ids.has(b.platformBookId)) push(i, `platformBookId 重复：${b.platformBookId}`);
  ids.add(b.platformBookId);
  if (!b.url?.endsWith(`/${b.platformBookId}`)) push(i, `url 与 platformBookId 对不上：${b.url}`);

  // 数值口径：wordCount 必须是整数「字」，不能残留字符串或「万字」
  if (b.wordCount !== null && (!Number.isInteger(b.wordCount) || b.wordCount <= 0))
    push(i, `wordCount 非正整数：${JSON.stringify(b.wordCount)}`);
  if (b.chapterTotal !== null && (!Number.isInteger(b.chapterTotal) || b.chapterTotal <= 0))
    push(i, `chapterTotal 非正整数：${JSON.stringify(b.chapterTotal)}`);

  if (!["连载", "完结", "unknown"].includes(b.status)) push(i, `status 非法：${b.status}`);

  for (const [f, v] of [["categories", b.categories], ["tags", b.tags]])
    if (v !== null && !Array.isArray(v)) push(i, `${f} 既非 null 也非数组`);

  for (const f of ["firstPublishDate", "lastUpdateDate"])
    if (b[f] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(b[f])) push(i, `${f} 非 YYYY-MM-DD：${b[f]}`);

  // simEvidence.matchedIn 不许留空，且必须真的对得上原文
  const se = b.simEvidence;
  if (!se || !Array.isArray(se.matchedIn) || !se.matchedIn.length) push(i, `simEvidence.matchedIn 为空`);
  else {
    const bad = se.matchedIn.filter((m) => !["title", "tag", "abstract"].includes(m));
    if (bad.length) push(i, `matchedIn 含非法值 ${bad.join(",")}`);
    if (se.matchedIn.includes("tag"))
      push(i, `matchedIn 含 tag：番茄无模拟类标签，结构上不可能命中，需核查判定`);
    for (const m of se.matchedIn) {
      const hay = m === "title" ? b.title : m === "abstract" ? b.abstract ?? "" : "";
      if (hay && !se.keywords.some((k) => hay.includes(k)))
        push(i, `matchedIn 声称命中 ${m}，但原文里找不到任一 keyword：${b.title}`);
    }
  }
  if (!se?.keywords?.length) push(i, `simEvidence.keywords 为空`);

  // 番茄特有：列表接口的私有字体混淆若漏进交付，表现为文本里带 PUA 码位
  for (const f of ["title", "author", "abstract"])
    if (PUA.test(String(b[f] ?? ""))) push(i, `${f} 残留 PUA 私有码位（字体混淆未清除）：${b.title}`);

  if (b.popularity !== null && (typeof b.popularity !== "object" || !("metric" in b.popularity)))
    push(i, `popularity 结构非法`);
  if (b.popularity && b.popularity.metric !== "在读") push(i, `popularity.metric 应为「在读」，实为 ${b.popularity.metric}`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(b.collectedAt ?? "")) push(i, `collectedAt 非 ISO：${b.collectedAt}`);
});

d.nearMiss.forEach((n, i) => {
  for (const k of ["title", "url", "reason"]) if (!n[k]) problems.push(`  nearMiss#${i} 缺 ${k}`);
  if (ids.has(String(n.url ?? "").split("/").pop()))
    problems.push(`  nearMiss#${i} 与 books 重复收录：${n.title}`);
});

// ---- 回源取证（SCHEMA 修订 4/5）----
// 形状类断言在这种数据上既漏又误，所以交付值不跟自己的形状比，跟源比：
// title/author/abstract/wordCount/status/popularity/lastUpdateDate 回 /api/book/info 的解析存档，
// chapterTotal/firstPublishDate 回书页 __INITIAL_STATE__ 的解析存档。全程零网络请求。
// 下面这两行映射是照 SCHEMA 第二节口径**独立重述**一遍，不是从 build 脚本 import——
// 与 build 共用同一份实现会让这条断言变成同义反复，什么也验不出来。
const STATUS = { "0": "完结", "1": "连载" };
const isoDay = (sec) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : null);

const arcMain = readJson(".scrape/sim/ch2_info.json", {});
const arcNon = readJson(".scrape/sim/ch2_info_noncult.json", {});
const arc = { ...arcNon, ...arcMain };
const pages = readJson(".scrape/sim/ch2_pages.json", {});

// 修订 5：取证的第一步是验存档，不是逐字比对。拿一张坏存档去「回源」比形状断言更糟，
// 它产出的是一份看起来有据可查的假数据。
log(`\n--- 存档先验 ---`);
const arcProblems = [];
if (!Object.keys(arc).length) arcProblems.push("  book/info 解析存档为空，无法取证");
if (!Object.keys(pages).length) arcProblems.push("  书页解析存档 ch2_pages.json 为空，无法取证");
let arcOk = 0, arcPua = 0;
for (const b of d.books) {
  const r = arc[b.platformBookId];
  if (!r) { arcProblems.push(`  ${b.title}：存档里没有这条记录（bookId=${b.platformBookId}）`); continue; }
  if (r._err) { arcProblems.push(`  ${b.title}：存档记录是失败记录（${r._err}）`); continue; }
  if (!r.bookName) { arcProblems.push(`  ${b.title}：存档记录无 bookName，是空壳`); continue; }
  // 番茄的「不报错的失败」长这样：列表接口的私有字体混淆混进来，文本合法但全是 PUA 码位。
  // 存档若已被污染，后面的逐字比对会一致地错，所以在这一层拦住。
  if (PUA.test(r.bookName) || PUA.test(r.abstract ?? "")) {
    arcPua++;
    arcProblems.push(`  ${b.title}：存档文本含 PUA 私有码位，该条存档不可用于取证`);
    continue;
  }
  arcOk++;
}
log(`   可用于取证的存档 ${arcOk}/${d.books.length}；PUA 污染 ${arcPua}；书页存档 ${Object.keys(pages).length} 条`);
if (arcProblems.length) { log(`   ❌ 存档先验不通过：`); arcProblems.slice(0, 20).forEach((p) => log(p)); }
problems.push(...arcProblems);

log(`\n--- 逐字比对交付值与存档 ---`);
const diffs = [];
const cmp = (b, field, got, want) => {
  if (got !== want) diffs.push(`  ${b.title} · ${field}：交付 ${JSON.stringify(got)} ≠ 存档 ${JSON.stringify(want)}`);
};
for (const b of d.books) {
  const r = arc[b.platformBookId];
  if (!r || r._err || !r.bookName) continue;
  cmp(b, "platformBookId", b.platformBookId, r.bookId);
  cmp(b, "title", b.title, r.bookName);
  cmp(b, "author", b.author, r.author ?? null);
  cmp(b, "abstract", b.abstract, r.abstract || null);
  cmp(b, "wordCount", b.wordCount, r.wordNumber || null);
  cmp(b, "status", b.status, STATUS[r.creationStatus] ?? "unknown");
  cmp(b, "popularity.raw", b.popularity?.raw ?? null, r.readCount || null);
  cmp(b, "lastUpdateDate", b.lastUpdateDate, isoDay(r.lastPublishTime));
  const pg = pages[b.platformBookId] ?? {};
  cmp(b, "chapterTotal", b.chapterTotal, pg.chapterTotal ?? null);
  cmp(b, "firstPublishDate", b.firstPublishDate, isoDay(pg.firstPassTime));
  // simEvidence 是判据留痕，回源重跑一遍关键词而不是信它自己
  for (const k of b.simEvidence.keywords) {
    const inTitle = String(r.bookName).includes(k);
    const inAbs = String(r.abstract ?? "").includes(k);
    if (!inTitle && !inAbs) diffs.push(`  ${b.title} · simEvidence：关键词「${k}」在存档的书名与简介里都找不到`);
  }
}
if (diffs.length) { log(`   ❌ ${diffs.length} 处交付值与存档不一致：`); diffs.slice(0, 20).forEach((s) => log(s)); }
else log(`   ✅ ${d.books.length} 本 × 10 个字段与存档逐字一致，simEvidence 关键词全部回源可查`);
problems.push(...diffs);

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
log(`   状态分布 ${JSON.stringify(st)}`);
const mi = {};
d.books.forEach((b) => { const k = b.simEvidence.matchedIn.join("+"); mi[k] = (mi[k] ?? 0) + 1; });
log(`   matchedIn 分布 ${JSON.stringify(mi)}`);
// 两池召回方式不同，合成一个比例会把「模拟是卖点还是里子」这条结论稀掉，按池分开给
const split = (list) => {
  let t = 0, a = 0, both = 0;
  for (const b of list) {
    const hasT = b.simEvidence.matchedIn.includes("title");
    const hasA = b.simEvidence.matchedIn.includes("abstract");
    if (hasT && hasA) both++; else if (hasT) t++; else if (hasA) a++;
  }
  return `${list.length} 本（仅title ${t} / 仅abstract ${a} / 两者都 ${both}）`;
};
const isNon = (b) => b.source.startsWith("[补池]");
log(`   命中方式分池：全部 ${split(d.books)}`);
log(`              主池 ${split(d.books.filter((b) => !isNon(b)))}`);
log(`              补池 ${split(d.books.filter(isNon))}`);
const kw = {};
d.books.forEach((b) => b.simEvidence.keywords.forEach((k) => (kw[k] = (kw[k] ?? 0) + 1)));
log(`   命中词分布 ${JSON.stringify(kw)}`);
const cats = {};
d.books.forEach((b) => (b.categories ?? []).forEach((c) => (cats[c] = (cats[c] ?? 0) + 1)));
log(`   分类分布 ${JSON.stringify(cats)}`);

// nearMiss 是这次专门补召回补出来的，单独看一眼它的形状
if (d.nearMiss.length) {
  log(`\n--- nearMiss 抽样（共 ${d.nearMiss.length} 条，列前 10）---`);
  d.nearMiss.slice(0, 10).forEach((n, i) => log(`   ${i + 1}. ${n.title} — ${n.reason.slice(0, 60)}…`));
}

log(`\n--- 结论 ---`);
if (problems.length) {
  log(`❌ ${problems.length} 处不合规：`);
  problems.slice(0, 40).forEach((p) => log(p));
  process.exitCode = 1;
} else {
  log(`✅ 全部 ${d.books.length} 条 books + ${d.nearMiss.length} 条 nearMiss 均符合 SCHEMA 第二节字段契约`);
}
log(`===== validate done =====`);
