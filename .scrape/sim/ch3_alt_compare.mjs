// 通道 3 · 只读其它通道的交付，给「中小站 vs 头部站」那问取证。不写不改它们。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));

// 塔读整池的体量基线：交付只有个位数本，n=1 的中位数说明不了体量，得拿整池比
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));
const pw = Object.values(pages).map((v) => v.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
console.log(`### 塔读整池（三个相关分类 ${Object.keys(pages).length} 本）`);
console.log(`  字数中位数=${pw[Math.floor(pw.length / 2)]}  最大=${pw[pw.length - 1]}  ≥100万字的 ${pw.filter((x) => x >= 1e6).length} 本（${((pw.filter((x) => x >= 1e6).length / pw.length) * 100).toFixed(1)}%）`);

for (const f of ["raw_ch2_fanqie.json", "raw_ch4_qimao.json", "raw_ch5_feilu.json", "raw_ch3_qidian.json"]) {
  const d = readJson(path.join(DIR, f));
  if (!d) {
    console.log(`\n### ${f} —— 不存在`);
    continue;
  }
  const books = d.books ?? [];
  const wc = books.map((b) => b.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
  const med = wc.length ? (wc.length % 2 ? wc[(wc.length - 1) / 2] : Math.round((wc[wc.length / 2 - 1] + wc[wc.length / 2]) / 2)) : null;
  const onlyAbs = books.filter((b) => {
    const m = b.simEvidence?.matchedIn ?? [];
    return m.includes("abstract") && !m.includes("title") && !m.includes("tag");
  }).length;
  const inTitle = books.filter((b) => (b.simEvidence?.matchedIn ?? []).includes("title")).length;
  console.log(`\n### ${f}`);
  console.log(`  status=${d.meta?.status} 平台=${JSON.stringify(d.meta?.platforms)} books=${books.length} nearMiss=${(d.nearMiss ?? []).length}`);
  console.log(`  字数中位数=${med}  书名带模拟词=${inTitle}  仅简介命中=${onlyAbs}`);
  const kw = {};
  for (const b of books) for (const k of b.simEvidence?.keywords ?? []) kw[k] = (kw[k] ?? 0) + 1;
  console.log(`  关键词分布=${JSON.stringify(kw)}`);
  for (const b of books.slice(0, 4)) {
    console.log(`  · ${b.title}（${b.platform}｜${b.wordCount}字｜${(b.tags ?? []).slice(0, 5).join("/")}）`);
    console.log(`      ${String(b.abstract ?? "").replace(/\s+/g, " ").slice(0, 110)}…`);
  }
}
