// 通道 5 · 通道 1 追加：books 换成简介全文后，401 本 nearMiss 仍按列表页 78 字截断版判定，
// 条件 B（修仙）恰恰最依赖简介正文，判据因此不对称。
// raw/ 里存档的书页 HTML 比进了 books 的 46 本多，多出来的若盖到 nearMiss，就地离线重判——零请求。
// 盖不到的不补抓（401 次新请求要先报通道 1）。
//
//   node .scrape/sim/ch5_nearmiss_recheck.mjs
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../lib.mjs";
import { strip, simHit, log } from "./ch5_lib.mjs";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "raw");

// 判据与 ch5_faloo.mjs 同一套，不另起口径。
const CULT_CAT = /玄幻|仙侠|修真|洪荒|神话|异世|奇幻|上古/;
const CULT_TEXT = /修仙|修真|炼气|筑基|金丹|元婴|宗门|灵根|大道/;
const boxAbstract = (h) =>
  strip(/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(h)?.[1] ?? "")
    .replace(/飞卢小说网提醒您：.*$/s, "")
    .trim() || null;

const { books, nearMiss } = readJson(path.join(DIR, "raw_ch5_feilu.json"));
const stage = readJson(path.join(RAW, "ch5_stage_faloo.json"));
const harvested = new Map(stage.harvested.list.map((b) => [b.id, b]));

const archived = new Set(
  fs.readdirSync(RAW).map((f) => /^ch5_faloo_(\d+)\.html$/.exec(f)?.[1]).filter(Boolean),
);
const inBooks = new Set(books.filter((b) => b.platform === "faloo").map((b) => b.platformBookId));
const nmById = new Map();
for (const n of nearMiss) {
  const id = /b\.faloo\.com\/(\d+)\.html/.exec(n.url ?? "")?.[1];
  if (id) nmById.set(id, n);
}

const extra = [...archived].filter((id) => !inBooks.has(id));
const covered = extra.filter((id) => nmById.has(id));
log(`[recheck] 存档书页 ${archived.size} 份，其中进了 books 的 ${[...archived].filter((id) => inBooks.has(id)).length} 份，多出 ${extra.length} 份`);
log(`[recheck] nearMiss 共 ${nearMiss.length} 条，其中 ${nmById.size} 条能从 url 解出飞卢 id`);
log(`[recheck] 多出来的存档盖到 nearMiss 的：${covered.length} 本`);
if (extra.length !== covered.length) {
  log(`[recheck] 另 ${extra.length - covered.length} 份既不在 books 也不在 nearMiss（探活/试解留下的），忽略`);
}

// 0 命中要先排除「id 根本没对上」这种假阴性，不能直接当结论。
const noId = nearMiss.filter((n) => !/b\.faloo\.com\/(\d+)\.html/.test(n.url ?? ""));
log(`[核对] 解不出 id 的 ${noId.length} 条，url 样例：${[...new Set(noId.slice(0, 3).map((n) => n.url))].join(" | ")}`);
log(`[核对] 多出来那 24 份的 id 去向：`);
for (const id of extra.slice(0, 24)) {
  const h = harvested.get(id);
  log(`    ${id} — ${h ? `在候选池：《${h.title}》分类「${h.listCategory ?? "?"}」simHit(title)=[${simHit(h.title)}] simHit(listIntro)=[${simHit(h.listIntro ?? "")}]` : "不在候选池（探活/试解）"}`);
}

let flip = 0;
for (const id of covered) {
  const n = nmById.get(id);
  const meta = harvested.get(id);
  const full = boxAbstract(fs.readFileSync(path.join(RAW, `ch5_faloo_${id}.html`), "utf8"));
  if (!full) {
    log(`  ? ${n.title} — Box1 解不出，维持 nearMiss`);
    continue;
  }
  // 条件 A 原本就过了（没过 A 的根本不进 nearMiss），这里只重判条件 B。
  const catHit = CULT_CAT.test(meta?.listCategory ?? "");
  const oldTextHit = CULT_TEXT.test(meta?.listIntro ?? "") || CULT_TEXT.test(n.title);
  const newTextHit = CULT_TEXT.test(full);
  const words = full.match(new RegExp(CULT_TEXT.source, "g")) ?? [];
  if (!oldTextHit && !catHit && newTextHit) {
    flip++;
    log(`  ✓ 翻转 ${n.title}（${meta?.listIntro?.length ?? 0}→${full.length} 字）命中修真词：${[...new Set(words)].join("、")}`);
    log(`      模拟词：${[...new Set([...simHit(n.title), ...simHit(full)])].join("、")}  分类「${meta?.listCategory ?? "未知"}」  ${n.url}`);
  } else {
    log(`  · 维持 ${n.title}（${full.length} 字全文仍无修真词）`);
  }
}
log(`[recheck] 换全文后应翻转进 books 的：${flip} 本`);
log(`[recheck] 剩余 ${nearMiss.length - covered.length} 条 nearMiss 无存档 HTML，按通道 1 的指示不补抓（需 401 次新请求，另行报批）`);
