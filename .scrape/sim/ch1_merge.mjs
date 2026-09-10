// 通道 1：把通道 2–5 交上来的四份原始抓取合并成 all_sim.json，并出一份校验报告。
// 用法：node .scrape/sim/ch1_merge.mjs
// 只读 raw_ch*.json，只写 all_sim.json 与 merge_report.txt，不碰任何通道的输入文件。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../lib.mjs";

// 仓库路径带中文，import.meta.url 是 percent-encoded 的（小说天团 → %E5%B0%8F…），
// 拿 .pathname 直接当路径会写到一个不存在的目录去。必须走 fileURLToPath 解码。
const DIR = fileURLToPath(new URL(".", import.meta.url));
const INPUTS = [
  ["raw_ch2_fanqie.json", 2],
  // 阅文系整站禁抓（SCHEMA 第 6 节），ch3_qidian 是 books:[] 的阻断留档，仍读进来是为了让
  // meta 里留下「这一格交过白卷」的痕迹；ch3_alt 才是通道 3 改派后的实际产出。
  ["raw_ch3_qidian.json", 3],
  ["raw_ch3_alt.json", 3],
  ["raw_ch4_qimao.json", 4],
  ["raw_ch5_feilu.json", 5],
];

const STATUS = new Set(["连载", "完结", "unknown"]);
const MATCHED_IN = new Set(["title", "tag", "abstract"]);

// 去重键：书名和作者在各站的写法不一致（全角括号、书名号、空格、繁简旁的空白），
// 不归一的话同一本书会在四份里各留一条，统计口径当场作废。
const norm = (s) =>
  String(s ?? "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[()（）【】《》〈〉「」『』·・.,，。！!？?~～\-—_+]/g, "")
    .toLowerCase();

const problems = [];
const flag = (ch, book, msg) =>
  problems.push(`ch${ch} · ${book?.title ?? "(无 title)"} · ${msg}`);

function validate(ch, b) {
  for (const f of ["platform", "title", "author", "url", "abstract"]) {
    if (!b?.[f]) flag(ch, b, `缺必填字段 ${f}`);
  }
  if (b?.wordCount != null && !Number.isInteger(b.wordCount)) {
    flag(ch, b, `wordCount 不是整数：${JSON.stringify(b.wordCount)}（「198.5万字」应写 1985000）`);
  }
  if (b?.status != null && !STATUS.has(b.status)) {
    flag(ch, b, `status 越界：${JSON.stringify(b.status)}，只允许 连载/完结/unknown`);
  }
  const m = b?.simEvidence?.matchedIn;
  if (!Array.isArray(m) || !m.length) flag(ch, b, "simEvidence.matchedIn 为空，收录判据没留痕");
  else for (const x of m) if (!MATCHED_IN.has(x)) flag(ch, b, `matchedIn 越界值：${x}`);
  for (const f of ["firstPublishDate", "lastUpdateDate"]) {
    const v = b?.[f];
    if (v != null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) flag(ch, b, `${f} 不是 YYYY-MM-DD：${v}`);
  }
}

// 「沙盘流」亚型判定（SCHEMA 修订 7 裁定，2026-09-09）。
// 沙盘流与模拟流是两个相反的机制：模拟流向内重活自己这一生、时间线回滚；
// 沙盘流向外造一个世界看它演化、主角本人不重来。两者共用「沙盘」这个词，
// 但可迁移的写法几乎为零。收录不变，**同题对标必须把它们排除**——
// 通道 3 实测这一族 28 本字数中位数只有 2.7 万、21/28 不足 5 万字，
// 混进分母会把字数中位数与标题句式两项结论一起带偏。
const isSandbox = (b) => {
  const kw = b?.simEvidence?.keywords;
  return Array.isArray(kw) && kw.length > 0 && kw.every((k) => k === "沙盘");
};

const merged = new Map(); // 去重键 -> 合并后的书
const missing = [];
const fileStatus = [];
let rawCount = 0;
let nearMissCount = 0;

for (const [file, ch] of INPUTS) {
  const p = path.join(DIR, file);
  const data = readJson(p);
  if (!data) {
    missing.push(`${file}（通道 ${ch} 尚未交付）`);
    continue;
  }
  // 空 books 有两种完全不同的含义：撞墙放弃（结论）vs 还没开工（待办）。
  // meta.status 是唯一能机器分辨这两者的东西，报告里必须原样带出来。
  fileStatus.push({
    file,
    channel: ch,
    status: data.meta?.status ?? "(未标 meta.status)",
    books: Array.isArray(data.books) ? data.books.length : 0,
    notes: data.meta?.notes ?? null,
  });
  const books = Array.isArray(data.books) ? data.books : [];
  nearMissCount += Array.isArray(data.nearMiss) ? data.nearMiss.length : 0;
  for (const b of books) {
    rawCount++;
    validate(ch, b);
    const key = `${norm(b?.title)}|${norm(b?.author)}`;
    const source = {
      channel: ch,
      platform: b?.platform ?? null,
      platformBookId: b?.platformBookId ?? null,
      url: b?.url ?? null,
      wordCount: b?.wordCount ?? null,
      chapterTotal: b?.chapterTotal ?? null,
      status: b?.status ?? null,
      popularity: b?.popularity ?? null,
      score: b?.score ?? null,
      lastUpdateDate: b?.lastUpdateDate ?? null,
      source: b?.source ?? null,
    };
    const hit = merged.get(key);
    if (!hit) {
      merged.set(key, {
        title: b?.title ?? null,
        author: b?.author ?? null,
        categories: b?.categories ?? [],
        tags: b?.tags ?? [],
        abstract: b?.abstract ?? null,
        openingHook: b?.openingHook ?? null,
        firstPublishDate: b?.firstPublishDate ?? null,
        simEvidence: b?.simEvidence ?? null,
        subtype: isSandbox(b) ? "沙盘流" : null,
        sources: [source],
      });
      continue;
    }
    hit.sources.push(source);
    // 跨站重复时只要有一站不是仅靠沙盘入选，就不算沙盘流亚型（从宽，宁可少排）
    if (hit.subtype === "沙盘流" && !isSandbox(b)) hit.subtype = null;
    // 同一本书上了多个站：取信息更全的那份当主记录，其余留在 sources 里可追。
    if (!hit.abstract && b?.abstract) hit.abstract = b.abstract;
    if (!hit.openingHook && b?.openingHook) hit.openingHook = b.openingHook;
    if (b?.firstPublishDate && (!hit.firstPublishDate || b.firstPublishDate < hit.firstPublishDate)) {
      hit.firstPublishDate = b.firstPublishDate; // 首发以最早的一站为准
    }
    for (const t of b?.tags ?? []) if (!hit.tags.includes(t)) hit.tags.push(t);
    for (const c of b?.categories ?? []) if (!hit.categories.includes(c)) hit.categories.push(c);
  }
}

const books = [...merged.values()];

const medianOf = (list) => {
  const w = list
    .map((b) => b.sources.map((s) => s.wordCount).find((x) => Number.isInteger(x)))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  if (!w.length) return null;
  return w.length % 2 ? w[(w.length - 1) / 2] : Math.round((w[w.length / 2 - 1] + w[w.length / 2]) / 2);
};

const sandbox = books.filter((b) => b.subtype === "沙盘流");
const simOnly = books.filter((b) => b.subtype !== "沙盘流");
const median = medianOf(books);
// 这个才是同题对标该用的数——排除沙盘流亚型之后的
const medianSim = medianOf(simOnly);

const byPlatform = {};
for (const b of books) for (const s of b.sources) byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + 1;
const crossPlatform = books.filter((b) => new Set(b.sources.map((s) => s.platform)).size > 1);

writeJson(path.join(DIR, "all_sim.json"), {
  meta: {
    mergedAt: new Date().toISOString(),
    inputs: INPUTS.map(([f]) => f),
    missingInputs: missing,
    fileStatus,
    rawRecords: rawCount,
    uniqueBooks: books.length,
    nearMissTotal: nearMissCount,
    wordCountMedian: median,
    // SCHEMA 修订 7：沙盘流是另一个机制，同题对标要用下面这两个数，不要用上面那个
    sandboxSubtypeCount: sandbox.length,
    simOnlyCount: simOnly.length,
    wordCountMedianExcludingSandbox: medianSim,
    byPlatform,
  },
  books,
});

const report = [
  `合并时间：${new Date().toISOString()}`,
  missing.length ? `缺少输入：${missing.join("、")}` : "输入齐全",
  "",
  "各份交付状态：",
  ...fileStatus.map((f) => `  ch${f.channel} ${f.file} → ${f.status}，${f.books} 本${f.status === "blocked-by-policy" ? "（0 本是结论不是待办，不要改派重抓）" : ""}`),
  "",
  `原始记录 ${rawCount} 条 → 去重后 ${books.length} 本（跨站重复 ${crossPlatform.length} 本）`,
  `nearMiss 合计 ${nearMissCount} 条`,
  `字数中位数（全部 ${books.length} 本）：${median ?? "无可用字数"}`,
  `字数中位数（排除沙盘流亚型，${simOnly.length} 本）：${medianSim ?? "无可用字数"}  ← 同题对标用这个`,
  `沙盘流亚型 ${sandbox.length} 本（SCHEMA 修订 7：向外造世界、时间线不回滚，与模拟流是相反的机制；收录保留、对标排除）`,
  `分平台条数：${JSON.stringify(byPlatform, null, 2)}`,
  "",
  problems.length ? `字段问题 ${problems.length} 条，需退回对应通道：` : "字段校验全过",
  ...problems,
  "",
  crossPlatform.length ? "跨站重复（同书多站，合并时首发日期取最早）：" : "",
  ...crossPlatform.map((b) => `  ${b.title} / ${b.author} → ${b.sources.map((s) => s.platform).join(" + ")}`),
].join("\n");

fs.writeFileSync(path.join(DIR, "merge_report.txt"), report, "utf8");
console.log(report);
