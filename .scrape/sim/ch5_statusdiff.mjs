// 通道 5：飞卢书页到底有没有状态标记。用已知完本的书和已知连载的书对比存档 HTML，
// 找真实存在的差异标记，而不是凭印象猜一个「大结局」关键词。
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../lib.mjs";
import { strip } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const faloo = readJson(path.join(RAW, "ch5_stage_faloo.json"));
const done = new Set(readJson(path.join(RAW, "ch5_stage_finished.json"), { set: [] }).set.map(String));
const serial = new Set(readJson(path.join(RAW, "ch5_stage_serial.json"), { set: [] }).set.map(String));

const title = (id) => faloo.pickedMeta.find((m) => m.id === id)?.title ?? id;
const load = (id) => {
  const p = path.join(RAW, `ch5_faloo_${id}.html`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

const have = (faloo.picked ?? []).filter((id) => load(id));
const A = have.filter((id) => done.has(String(id)));
const B = have.filter((id) => serial.has(String(id)));
console.log(`已知完本 ${A.length} 本：` + A.map(title).join("、"));
console.log(`已知连载 ${B.length} 本：` + B.map(title).join("、"));

// 候选标记词：只报「在一组里普遍出现、在另一组里普遍不出现」的
const CAND = ["完本", "已完本", "大结局", "全书完", "完本感言", "本书完结", "全文完", "完结", "新书", "书友群"];
console.log("\n词\t\t完本组命中/总\t连载组命中/总");
for (const w of CAND) {
  const a = A.filter((id) => (load(id).match(new RegExp(w, "g")) ?? []).length > 3).length;
  const b = B.filter((id) => (load(id).match(new RegExp(w, "g")) ?? []).length > 3).length;
  console.log(`${w}\t\t${a}/${A.length}\t\t${b}/${B.length}`);
}

// 末章名对比：完本书的最后一章通常带结局字样
console.log("\n=== 末章名");
for (const [label, group] of [["完本", A], ["连载", B]]) {
  for (const id of group.slice(0, 6)) {
    const h = load(id);
    const last = [...h.matchAll(new RegExp(`${id}_\\d+\\.html"[^>]*title="([^"]+)"`, "g"))].at(-1)?.[1];
    const meta = /<meta[^>]+name="og:novel:latest_chapter_name"[^>]*content="([^"]*)"/.exec(h)?.[1];
    console.log(`  [${label}] ${title(id)} → 末章「${strip(last ?? "?")}」 og最新「${strip(meta ?? "?")}」`);
  }
}
