// 通道 5 交付前校验：字段口径、乱码、判据留痕、nearMiss 合理性，并抽样打印整条记录。
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../lib.mjs";
import { strip, log } from "./ch5_lib.mjs";

// 「以 ... 结尾」只是嫌疑，不是结论：飞卢有作者自己在简介里打省略号的。
// 判成真截断之前先回存档 HTML 取证——与书页 T-L-T-C-Box1 逐字一致的就是站方原文。
const archived = new Map();
function siteAbstract(b) {
  if (b.platform !== "faloo") return null;
  if (!archived.has(b.platformBookId)) {
    const p = path.join(import.meta.dirname, "raw", `ch5_faloo_${b.platformBookId}.html`);
    const h = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    archived.set(
      b.platformBookId,
      h == null ? null : strip(/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(h)?.[1] ?? "").replace(/飞卢小说网提醒您：.*$/s, "").trim() || null,
    );
  }
  return archived.get(b.platformBookId);
}

const out = readJson(path.join(import.meta.dirname, "raw_ch5_feilu.json"));
const { books, nearMiss, meta } = out;
const bad = [];
const siteEllipsis = [];
const REQUIRED = ["platform", "platformBookId", "title", "author", "url", "wordCount", "chapterTotal", "status", "categories", "tags", "abstract", "popularity", "score", "firstPublishDate", "lastUpdateDate", "simEvidence", "openingHook", "collectedAt", "source"];

for (const b of books) {
  for (const k of REQUIRED) if (!(k in b)) bad.push(`${b.title} 缺字段 ${k}`);
  for (const k of Object.keys(b)) if (!REQUIRED.includes(k)) bad.push(`${b.title} 多出字段 ${k}`);
  if (!["faloo", "zongheng", "17k"].includes(b.platform)) bad.push(`${b.title} platform=${b.platform}`);
  if (!["连载", "完结", "unknown"].includes(b.status)) bad.push(`${b.title} status=${b.status}`);
  if (b.wordCount != null && (!Number.isInteger(b.wordCount) || b.wordCount <= 0)) bad.push(`${b.title} wordCount=${b.wordCount}`);
  if (b.popularity?.metric !== "点击") bad.push(`${b.title} metric=${b.popularity?.metric}`);
  if (!b.simEvidence?.matchedIn?.length) bad.push(`${b.title} simEvidence.matchedIn 空`);
  for (const m of b.simEvidence?.matchedIn ?? []) if (!["title", "tag", "abstract"].includes(m)) bad.push(`${b.title} matchedIn 含 ${m}`);
  for (const d of [b.firstPublishDate, b.lastUpdateDate]) if (d != null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) bad.push(`${b.title} 日期格式 ${d}`);
  const blob = JSON.stringify(b);
  if (blob.includes("\uFFFD") || /[\u00c0-\u00ff]{3,}/.test(blob)) bad.push(`${b.title} 疑似乱码`);
  if (b.openingHook && b.openingHook.length > 200) bad.push(`${b.title} openingHook 超 200 字`);
  if (b.abstract?.endsWith("...")) {
    const site = siteAbstract(b);
    if (site == null) bad.push(`${b.title} abstract 以 ... 结尾，且无存档 HTML 可取证`);
    else if (site !== b.abstract) bad.push(`${b.title} abstract 被截断：存档 Box1 有 ${site.length} 字，本条只 ${b.abstract.length} 字`);
    else siteEllipsis.push(b.title);
  }
}
const ids = books.map((b) => b.platform + ":" + b.platformBookId);
if (new Set(ids).size !== ids.length) bad.push("books 内有重复 id");

log(`[校验] books=${books.length} nearMiss=${nearMiss.length} 问题=${bad.length}`);
for (const x of bad.slice(0, 20)) log("  ✗ " + x);
if (siteEllipsis.length) log(`  · 站方原文即以 ... 结尾（已逐条比对存档 Box1，非截断）${siteEllipsis.length} 本：${siteEllipsis.join("、")}`);
const abs = books.filter((b) => b.platform === "faloo").map((b) => b.abstract?.length ?? 0).sort((a, b) => a - b);
log(`[校验] 飞卢 abstract 长度 最短 ${abs[0]} / 中位 ${abs[Math.floor(abs.length / 2)]} / 最长 ${abs.at(-1)}`);

log("\n[分布] 状态：" + JSON.stringify(books.reduce((a, b) => ((a[b.status] = (a[b.status] ?? 0) + 1), a), {})));
log("[分布] 平台：" + JSON.stringify(meta.counts));
const w = books.map((b) => b.wordCount).filter(Boolean).sort((a, b) => a - b);
log(`[分布] 字数 最小 ${w[0]} / 中位 ${w[Math.floor(w.length / 2)]} / 最大 ${w.at(-1)}`);
const y = books.reduce((a, b) => ((a[b.firstPublishDate.slice(0, 4)] = (a[b.firstPublishDate.slice(0, 4)] ?? 0) + 1), a), {});
log("[分布] 首发年份：" + Object.entries(y).sort().map(([k, v]) => `${k}×${v}`).join("  "));

log("\n[抽样] 一条飞卢完整记录：");
log(JSON.stringify(books.find((b) => b.platform === "faloo" && b.openingHook), null, 2));
log("\n[抽样] 一条纵横完整记录：");
log(JSON.stringify(books.find((b) => b.platform === "zongheng" && b.openingHook), null, 2));
log("\n[抽样] nearMiss 前 6 条：");
for (const n of nearMiss.slice(0, 6)) log(`  ${n.title} — ${n.reason}`);
