// 通道 3 · raw_ch3_alt.json 字段自检。交付前必须全绿。
// 校验口径完全照 SCHEMA 第 2 节（字段与取值）与第 3 节（文件结构、meta.status 三值）。
// 与 ch1_merge.mjs 的 validate() 同源，但多查几条它不查、却会让合并结果失真的：
//   · wordCount 明显是「万」没换算（<1000 的整数）——SCHEMA 要求一律换算成「字」
//   · popularity.metric 跨站折算（塔读只允许它自己的口径）
//   · abstract 被截断（以 … 结尾）——SCHEMA 要求全文不截断
//   · 同一 platformBookId 重复
// 用法：node .scrape/sim/ch3_validate.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const FILE = path.join(DIR, "raw_ch3_alt.json");
const data = readJson(FILE);

const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

if (!data) {
  console.error("raw_ch3_alt.json 不存在");
  process.exit(1);
}

// ---------- meta ----------
const STATUS_META = new Set(["ok", "partial", "blocked-by-policy"]);
if (data.meta?.channel !== 3) E(`meta.channel 应为 3，实为 ${JSON.stringify(data.meta?.channel)}`);
if (!STATUS_META.has(data.meta?.status)) E(`meta.status 越界：${JSON.stringify(data.meta?.status)}，只允许 ok/partial/blocked-by-policy`);
if (!Array.isArray(data.meta?.platforms) || !data.meta.platforms.length) E("meta.platforms 为空");
if (!Array.isArray(data.meta?.entryPoints) || !data.meta.entryPoints.length) E("meta.entryPoints 为空");
if (!data.meta?.notes) E("meta.notes 为空：拿不到的字段必须写清卡在哪一层");
if (!Array.isArray(data.books)) E("books 不是数组");
if (!Array.isArray(data.nearMiss)) E("nearMiss 不是数组");

// ---------- 每本书 ----------
const STATUS = new Set(["连载", "完结", "unknown"]);
const MATCHED_IN = new Set(["title", "tag", "abstract"]);
const PLATFORMS = new Set(["tadu", "shuqi"]);
// SCHEMA：popularity.metric 各平台口径不同，不许强行折算。通道 3 两站各自的合法口径：
const METRIC_OK = { tadu: new Set(["周人气"]), shuqi: new Set(["人气", "阅读人数"]) };

const seen = new Map();
for (const [i, b] of (data.books ?? []).entries()) {
  const at = `books[${i}] ${b?.title ?? "(无 title)"}`;
  for (const f of ["platform", "platformBookId", "title", "author", "url", "abstract"]) {
    if (b?.[f] == null || b[f] === "") E(`${at}：缺必填字段 ${f}`);
  }
  if (!PLATFORMS.has(b?.platform)) E(`${at}：platform 越界 ${JSON.stringify(b?.platform)}`);

  const key = `${b?.platform}|${b?.platformBookId}`;
  if (seen.has(key)) E(`${at}：platformBookId 重复，与 books[${seen.get(key)}] 撞车`);
  else seen.set(key, i);

  if (b?.wordCount != null) {
    if (!Number.isInteger(b.wordCount)) E(`${at}：wordCount 不是整数 ${JSON.stringify(b.wordCount)}`);
    else if (b.wordCount > 0 && b.wordCount < 1000) E(`${at}：wordCount=${b.wordCount} 疑似「万」未换算成「字」`);
  }
  if (b?.chapterTotal != null && !Number.isInteger(b.chapterTotal)) E(`${at}：chapterTotal 不是整数`);
  if (!STATUS.has(b?.status)) E(`${at}：status 越界 ${JSON.stringify(b?.status)}`);
  if (!Array.isArray(b?.categories)) E(`${at}：categories 不是数组`);
  if (!Array.isArray(b?.tags)) E(`${at}：tags 不是数组`);

  const m = b?.simEvidence?.matchedIn;
  if (!Array.isArray(m) || !m.length) E(`${at}：simEvidence.matchedIn 为空，收录判据没留痕`);
  else for (const x of m) if (!MATCHED_IN.has(x)) E(`${at}：matchedIn 越界值 ${x}`);
  if (!Array.isArray(b?.simEvidence?.keywords) || !b.simEvidence.keywords.length) E(`${at}：simEvidence.keywords 为空`);
  // 留痕必须对得上原文：说 title 命中，书名里就得真有那个词
  if (m?.includes("title") && !b.simEvidence.keywords.some((k) => String(b.title).includes(k))) {
    E(`${at}：matchedIn 含 title，但书名里找不到任何 keywords`);
  }
  if (m?.includes("abstract") && !b.simEvidence.keywords.some((k) => String(b.abstract ?? "").includes(k))) {
    E(`${at}：matchedIn 含 abstract，但简介里找不到任何 keywords`);
  }
  if (m?.includes("tag") && !b.simEvidence.keywords.some((k) => (b.tags ?? []).join(" ").includes(k))) {
    E(`${at}：matchedIn 含 tag，但标签里找不到任何 keywords`);
  }

  for (const f of ["firstPublishDate", "lastUpdateDate"]) {
    const v = b?.[f];
    if (v != null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) E(`${at}：${f} 不是 YYYY-MM-DD：${v}`);
  }
  if (b?.popularity != null) {
    if (typeof b.popularity !== "object" || !("metric" in b.popularity) || !("raw" in b.popularity)) {
      E(`${at}：popularity 结构不对，应为 {metric, raw}`);
    } else if (b.popularity.metric != null && !METRIC_OK[b.platform]?.has(b.popularity.metric)) {
      E(`${at}：popularity.metric="${b.popularity.metric}" 不是 ${b.platform} 的原生口径，疑似跨站折算`);
    }
  }
  // 只报提示不报错：SCHEMA 修订 4（通道 5 踩过）——省略号是字符串启发式，既误报（作者自己
  // 打的省略号）又漏报（站方直接切断不留省略号）。真正的判据是与存档 HTML 的正文区逐字比对，
  // 见下方 verifyAgainstArchive。这一条只当「值得回源看一眼」的线索用。
  if (typeof b?.abstract === "string" && /(\.\.\.|…|\u2026)\s*$/.test(b.abstract)) {
    W(`${at}：abstract 以省略号结尾，回源确认是作者原文还是被截断`);
  }
  if (b?.url && !String(b.url).startsWith("http")) E(`${at}：url 不是完整 URL`);
  if (b?.collectedAt && Number.isNaN(Date.parse(b.collectedAt))) E(`${at}：collectedAt 不是合法时间`);
}

// ---------- abstract 回源取证（SCHEMA 修订 4 的做法） ----------
// 有存档 HTML 的书，把交付里的 abstract 与存档正文区逐字比对；没有存档的如实报「未取证」，
// 不用启发式糊过去。塔读简介在 <p class="intro">。
import fs from "node:fs";
const RAW = path.join(DIR, "raw");
let verified = 0;
let unverified = 0;
for (const b of data.books ?? []) {
  const hit = fs.existsSync(RAW)
    ? fs.readdirSync(RAW).find((f) => f.includes(`_${b.platformBookId}.html`) || f.includes(`_${b.platformBookId}_`))
    : null;
  if (!hit) {
    unverified++;
    continue;
  }
  const html = fs.readFileSync(path.join(RAW, hit), "utf8");
  const src = String(html.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!src) {
    W(`${b.title}：存档 ${hit} 里没解出简介，无法回源比对`);
  } else if (src.replace(/\s/g, "") !== String(b.abstract).replace(/\s/g, "")) {
    E(`${b.title}：abstract 与存档 HTML 正文区不一致（存档 ${src.length} 字 / 交付 ${String(b.abstract).length} 字）`);
  } else verified++;
}
console.log(`abstract 回源取证：与存档 HTML 逐字一致 ${verified} 本，无存档未取证 ${unverified} 本`);

// ---------- nearMiss ----------
for (const [i, n] of (data.nearMiss ?? []).entries()) {
  if (!n?.title) E(`nearMiss[${i}]：缺 title`);
  if (!n?.reason) E(`nearMiss[${i}]：缺 reason（为什么被排除，是这批样本的全部价值）`);
}

// ---------- 汇总 ----------
const byPlatform = {};
for (const b of data.books ?? []) byPlatform[b.platform] = (byPlatform[b.platform] ?? 0) + 1;
const wc = (data.books ?? []).map((b) => b.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
const median = wc.length ? (wc.length % 2 ? wc[(wc.length - 1) / 2] : Math.round((wc[wc.length / 2 - 1] + wc[wc.length / 2]) / 2)) : null;
const nullRate = (f) => {
  const t = data.books?.length ?? 0;
  if (!t) return "0/0";
  const n = data.books.filter((b) => b[f] == null || (Array.isArray(b[f]) && !b[f].length)).length;
  return `${n}/${t} (${((n / t) * 100).toFixed(0)}%)`;
};

console.log(`raw_ch3_alt.json：books ${data.books?.length ?? 0}（${JSON.stringify(byPlatform)}），nearMiss ${data.nearMiss?.length ?? 0}`);
console.log(`meta.status=${data.meta?.status} platforms=${JSON.stringify(data.meta?.platforms)}`);
console.log(`字数中位数 ${median}；空值率 wordCount ${nullRate("wordCount")} / chapterTotal ${nullRate("chapterTotal")} / lastUpdateDate ${nullRate("lastUpdateDate")} / tags ${nullRate("tags")} / openingHook ${nullRate("openingHook")} / firstPublishDate ${nullRate("firstPublishDate")}`);
if (warns.length) {
  console.log(`\n提示 ${warns.length} 条：`);
  for (const w of warns.slice(0, 20)) console.log("  " + w);
  if (warns.length > 20) console.log(`  …另 ${warns.length - 20} 条`);
}
if (errors.length) {
  console.log(`\n✗ 字段问题 ${errors.length} 条：`);
  for (const e of errors.slice(0, 40)) console.log("  " + e);
  if (errors.length > 40) console.log(`  …另 ${errors.length - 40} 条`);
  process.exit(1);
}
console.log("\n✓ 字段自检全过");
