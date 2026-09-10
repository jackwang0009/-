// 通道 5 · 复核 picked 与 books 的落差：ch5_faloo.mjs 第 151 行 picked.slice(0, 46) 是硬上限，
// 而 SCHEMA 第 5 节修订 3 已拆掉 40–80 本上限，改为「凡过判据的全收」。
// 这里只读候选池重跑一遍判据，看被 46 这个数切掉了多少本、其中多少本已有存档 HTML（补进去零请求）。
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../lib.mjs";
import { simHit, log } from "./ch5_lib.mjs";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "raw");
const CULT_CAT = /玄幻|仙侠|修真|洪荒|神话|异世|奇幻|上古/;
const CULT_TEXT = /修仙|修真|炼气|筑基|金丹|元婴|宗门|灵根|大道/;

const { books } = readJson(path.join(DIR, "raw_ch5_feilu.json"));
const stage = readJson(path.join(RAW, "ch5_stage_faloo.json"));
const inBooks = new Set(books.filter((b) => b.platform === "faloo").map((b) => b.platformBookId));
const archived = new Set(fs.readdirSync(RAW).map((f) => /^ch5_faloo_(\d+)\.html$/.exec(f)?.[1]).filter(Boolean));

const picked = [];
for (const b of stage.harvested.list) {
  const a = simHit(b.title).length || simHit(b.listIntro ?? "").length;
  if (!a) continue;
  if (CULT_CAT.test(b.listCategory ?? "") || CULT_TEXT.test(b.listIntro ?? "") || CULT_TEXT.test(b.title)) picked.push(b);
}
picked.sort((a, b) => (b.listClick ?? 0) - (a.listClick ?? 0));

const dropped = picked.filter((b) => !inBooks.has(b.id));
const droppedWithHtml = dropped.filter((b) => archived.has(b.id));
log(`[audit] 候选池 ${stage.harvested.list.length} 本 → 过 A+B 判据 ${picked.length} 本 → 实际进 books ${inBooks.size} 本`);
log(`[audit] 被 picked.slice(0, 46) 切掉 ${dropped.length} 本，其中已有存档 HTML 的 ${droppedWithHtml.length} 本（补进去零请求）`);
log(`[audit] 无存档、要补抓才能进的 ${dropped.length - droppedWithHtml.length} 本`);
log(`[audit] stage.details 已解出的 ${Object.keys(stage.details).length} 本`);
log("");
log("被切掉且已有存档的（按列表页点击降序）：");
for (const b of droppedWithHtml) log(`    ${b.id} 点击${b.listClick ?? "?"} 《${b.title}》分类「${b.listCategory}」`);
// 交付 2「最早 5 本」是按 firstPublishDate 排的。被切掉的若有更早的，那一项结论就得改。
// 24 本有存档的能当场查（入站时间在书页上），88 本无存档的只能拿列表页日期做上界推断。
log("");
log("[风险] 被切掉的书会不会改写「最早 5 本」——现任第 5 名是 2020-07-25：");
const strip2 = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const earlier = [];
for (const b of droppedWithHtml) {
  const flat = strip2(fs.readFileSync(path.join(RAW, `ch5_faloo_${b.id}.html`), "utf8")).replace(/\s+/g, " ");
  const d = /入站时间[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(flat)?.[1] ?? null;
  if (d && d < "2020-07-25") earlier.push([d, b.title]);
}
log(`    24 本有存档的里，入站时间早于 2020-07-25 的：${earlier.length} 本` + (earlier.length ? "\n" + earlier.sort().map(([d, t]) => `      ${d} 《${t}》`).join("\n") : ""));
const listDates = dropped.filter((x) => !archived.has(x.id)).map((b) => b.listDate).filter(Boolean).sort();
log(`    88 本无存档的：列表页日期（末更，非入站）最早 ${listDates[0] ?? "—"}，早于 2019-09-22 的 ${listDates.filter((d) => d < "2019-09-22").length} 本`);
log("      注：列表页给的是末更日期，入站只会更早，所以这只是个上界，不能当结论。");

log("");
log("被切掉且无存档的：");
for (const b of dropped.filter((x) => !archived.has(x.id))) log(`    ${b.id} 点击${b.listClick ?? "?"} 《${b.title}》分类「${b.listCategory}」`);
