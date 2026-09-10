// 通道 3 · 人工复核两件事：
//  1) KW_SIM_LOOSE（重开/无限重生/推演/演算）命中的书，词义是不是「同一段时间反复重来」。
//     「重开」尤其危险：修仙文里「重开山门」「重开天地」「重开一局」都用这两个字，词形命中
//     不等于题材命中。把命中处上下文抠出来，逐条肉眼判。
//  2) 判据词表之外的近义写法（推衍/回档/存档读档/轮回重来…）在本池能多召回几本。
//     词表是 SCHEMA 定的，本通道不自己改；只统计出来回报通道 1，由它决定要不要动判据。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";
import { KW_SIM_LOOSE, simHits } from "./ch3_alt_kw.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));
const REL = ["东方玄幻", "武侠仙侠", "脑洞创意"];

console.log("=== 1. 命中书逐条复核 ===");
for (const b of cand.books.filter((x) => REL.includes(x.cat))) {
  const p = pages[b.id];
  if (!p || p.error) continue;
  const hay = `${b.title}\n${p.abstract ?? ""}\n${(p.tags ?? []).join(" ")}`;
  const hits = simHits(hay);
  if (!hits.length) continue;
  const loose = hits.filter((k) => KW_SIM_LOOSE.has(k));
  console.log(`\n--- ${b.id} [${b.cat}] ${b.title} — ${b.author}`);
  console.log(`  命中 ${hits.join("/")}${loose.length ? `（含需复核词 ${loose.join("/")}）` : ""}`);
  console.log(`  标签: ${(p.tags ?? []).join(", ")}`);
  console.log(`  字数 ${p.wordCount} 章数 ${p.chapterTotal} 更新 ${p.lastUpdateDate} 状态 ${b.status}`);
  console.log(`  简介全文: ${(p.abstract ?? "").replace(/\n/g, " ⏎ ")}`);
  for (const k of hits) {
    const i = (p.abstract ?? "").indexOf(k);
    if (i >= 0) console.log(`  「${k}」上下文: …${(p.abstract ?? "").slice(Math.max(0, i - 45), i + 45).replace(/\n/g, " ")}…`);
  }
}

console.log("\n\n=== 2. 词表之外的近义写法能多召回几本（只统计，不改判据） ===");
const EXTRA = ["推衍", "回档", "存档", "读档", "轮回重来", "重来一次", "重活", "复盘", "推算命运", "时光倒流", "倒带"];
const found = {};
for (const b of cand.books.filter((x) => REL.includes(x.cat))) {
  const p = pages[b.id];
  if (!p || p.error) continue;
  const hay = `${b.title}\n${p.abstract ?? ""}\n${(p.tags ?? []).join(" ")}`;
  if (simHits(hay).length) continue; // 已被词表收走的不算增量
  for (const k of EXTRA) {
    if (!hay.includes(k)) continue;
    (found[k] ??= []).push(`${b.title}（${b.cat}）`);
  }
}
for (const [k, list] of Object.entries(found)) {
  console.log(`  「${k}」 +${list.length} 本: ${list.slice(0, 6).join("、")}${list.length > 6 ? "…" : ""}`);
}
if (!Object.keys(found).length) console.log("  无增量：词表之外的近义写法在本池一本都没多召回");
