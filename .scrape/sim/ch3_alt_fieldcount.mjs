// 通道 3 · A 件第一步：零请求核数。「396/396 修复、剩余空简介 0」与「还有 221 本要补」
// 这两句不能同时成立，先数清楚现在到底什么是空的，再决定要不要动网络。
// 分别数两个口径：① 书页缓存 ch3_alt_pages.json（1061 本，nearMiss 与统计都靠它）
//                ② 交付 raw_ch3_alt.json（1 本 books + 6 条 nearMiss）
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const deliv = readJson(path.join(DIR, "raw_ch3_alt.json"));
const byId = new Map(cand.books.map((b) => [b.id, b]));

const ids = Object.keys(pages);
const ok = ids.filter((id) => !pages[id].error);
console.log(`书页缓存 ${ids.length} 条（error ${ids.length - ok.length} 条）`);

const FIELDS = ["abstract", "tags", "wordCount", "popularityRaw", "votes", "chapterTotal", "lastUpdateDate"];
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
console.log("\n各字段空值数（分母 = 非 error 的 " + ok.length + " 条）：");
const emptyBy = {};
for (const f of FIELDS) {
  const list = ok.filter((id) => isEmpty(pages[id][f]));
  emptyBy[f] = list;
  console.log(`  ${f.padEnd(14)} 空 ${String(list.length).padStart(4)} 本  (${((list.length / ok.length) * 100).toFixed(1)}%)`);
}
// popularityRaw=0 与 null 是两回事：0 是站方原样显示，不算缺字段
const popZero = ok.filter((id) => pages[id].popularityRaw === 0).length;
const popNull = ok.filter((id) => pages[id].popularityRaw == null).length;
console.log(`  ↑ 其中 popularityRaw：真 null ${popNull} 本，站方显示为 0 的 ${popZero} 本（后者不是缺字段）`);

// 「整条解析链一起断」的那种全空书还有没有——这才是当初 396 本的形态
const allBlank = ok.filter((id) => FIELDS.every((f) => isEmpty(pages[id][f]) || pages[id][f] === 0));
console.log(`\n七项全空（当初 396 本的形态）：${allBlank.length} 本`);

// 有没有哪个数字接近 221
const counts = Object.entries(emptyBy).map(([f, l]) => `${f}=${l.length}`);
console.log(`对照 221 这个数：${counts.join("  ")}`);
const near = Object.entries(emptyBy).filter(([, l]) => Math.abs(l.length - 221) <= 30);
console.log(near.length ? `接近 221 的字段：${near.map(([f, l]) => `${f}(${l.length})`).join("、")}` : "没有任何字段的空值数接近 221");

// 交付文件本身
console.log(`\n交付 raw_ch3_alt.json：books ${deliv.books.length}，nearMiss ${deliv.nearMiss.length}`);
for (const b of deliv.books) {
  const nulls = Object.entries(b).filter(([, v]) => v == null || (Array.isArray(v) && !v.length)).map(([k]) => k);
  console.log(`  ${b.title}：为 null 的字段 ${nulls.join("/") || "无"}`);
}

// 空 lastUpdateDate 的书，是解析失败还是站方没给——抽几本看它们在候选池里的样子
if (emptyBy.lastUpdateDate.length) {
  console.log(`\n空 lastUpdateDate 的前 5 本（用于判是解析失败还是站方不给）：`);
  for (const id of emptyBy.lastUpdateDate.slice(0, 5)) {
    const c = byId.get(id);
    console.log(`  ${id} [${c?.cat}] ${c?.title}｜简介 ${(pages[id].abstract ?? "").length} 字｜章数 ${pages[id].chapterTotal}｜字数 ${pages[id].wordCount}`);
  }
}
