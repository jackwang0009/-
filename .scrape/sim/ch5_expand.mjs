// 通道 5 扩样第一步（零请求）：把 raw/ 里已存档的飞卢书页全部离线重解进 stage.details。
// 两件事：① 给已有的 46 条补上当初没解的 abstract；② 把 24 本「有存档但从没进 details」的补进去。
// 跑完再跑 ch5_faloo.mjs 去抓剩下那 88 本——顺序反了的话，解析若有问题，88 次请求就白发了。
//
//   node .scrape/sim/ch5_expand.mjs          空转，只报差异
//   node .scrape/sim/ch5_expand.mjs --apply  写回 raw/ch5_stage_faloo.json
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib.mjs";
import { parseFalooDetail, simHit, log } from "./ch5_lib.mjs";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "raw");
const STAGE = path.join(RAW, "ch5_stage_faloo.json");
const APPLY = process.argv.includes("--apply");

const CULT_CAT = /玄幻|仙侠|修真|洪荒|神话|异世|奇幻|上古/;
const CULT_TEXT = /修仙|修真|炼气|筑基|金丹|元婴|宗门|灵根|大道/;

const stage = readJson(STAGE);
const harvested = new Map(stage.harvested.list.map((b) => [b.id, b]));

// 判据与 ch5_faloo.mjs 主流程逐字相同
const picked = [];
for (const b of stage.harvested.list) {
  if (!simHit(b.title).length && !simHit(b.listIntro ?? "").length) continue;
  if (CULT_CAT.test(b.listCategory ?? "") || CULT_TEXT.test(b.listIntro ?? "") || CULT_TEXT.test(b.title)) picked.push(b);
}
picked.sort((a, b) => (b.listClick ?? 0) - (a.listClick ?? 0));
const pickedIds = new Set(picked.map((b) => b.id));

const archived = fs.readdirSync(RAW).map((f) => /^ch5_faloo_(\d+)\.html$/.exec(f)?.[1]).filter(Boolean);
let filled = 0;
let added = 0;
let absBackfilled = 0;
const bad = [];

for (const id of archived) {
  if (!pickedIds.has(id)) continue; // 只处理过判据的，探活残留不动
  const html = fs.readFileSync(path.join(RAW, `ch5_faloo_${id}.html`), "utf8");
  if (html.length < 5000) {
    bad.push(`${id} 存档长度仅 ${html.length}，疑似过渡页/拦截页，不解`);
    continue;
  }
  const d = parseFalooDetail(html, id);
  if (!d.firstPublishDate && !d.wordCount) {
    bad.push(`${id} 解出来的入站时间与字数都是空，存档可疑`);
    continue;
  }
  const had = stage.details[id];
  if (!had) added++;
  else if (!had.abstract && d.abstract) absBackfilled++;
  filled++;
  if (APPLY) stage.details[id] = d;
}

log(`[expand] 过判据 ${picked.length} 本；已存档书页 ${archived.length} 份（其中过判据的 ${archived.filter((id) => pickedIds.has(id)).length} 份）`);
log(`[expand] 离线可解 ${filled} 本：新增 details ${added} 本，给已有 details 补 abstract ${absBackfilled} 本`);
for (const x of bad) log("  ✗ " + x);

if (APPLY) {
  stage.picked = picked.map((b) => b.id);
  stage.pickedMeta = picked;
  writeJson(STAGE, stage);
  log(`[expand] 已写回 stage：details ${Object.keys(stage.details).length} 本，pickedMeta ${stage.pickedMeta.length} 本`);
}
const remain = picked.filter((b) => !(APPLY ? stage.details[b.id] : stage.details[b.id])?.firstPublishDate);
log(`[expand] 仍需联网补抓详情页：${remain.length} 本`);
