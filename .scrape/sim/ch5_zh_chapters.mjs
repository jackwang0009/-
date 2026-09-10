// 通道 5：纵横章节数与首章日期。目录页一趟同时给出两者，比只取日期少跑一遍。
import fs from "node:fs";
import path from "node:path";
import { sleep, writeJson, readJson } from "../lib.mjs";
import { getHtml, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const OUT = path.join(RAW, "ch5_stage_zh_chapters.json");
const zh = readJson(path.join(RAW, "ch5_stage_zongheng.json"), { picked: [] });
const out = readJson(OUT, {});

for (const id of zh.picked ?? []) {
  if (out[id]) continue;
  try {
    const r = await getHtml(`https://book.zongheng.com/showchapter/${id}.html`, 2);
    fs.writeFileSync(path.join(RAW, `ch5_zhtoc_${id}.html`), r.html, "utf8");
    const chapters = new Set([...r.html.matchAll(/\/chapter\/\d+\/(\d+)\.html/g)].map((m) => m[1]));
    const dates = [...r.html.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]).sort();
    out[id] = { chapterTotal: chapters.size || null, firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null };
    writeJson(OUT, out);
    log(`[zhtoc] ${id} 章=${out[id].chapterTotal} 首章=${out[id].firstDate}`);
  } catch (e) {
    log(`[zhtoc] ${id} 失败 ${e.message}`);
  }
  await sleep(1200);
}
log(`[zhtoc] 完成 ${Object.keys(out).length} 本`);
