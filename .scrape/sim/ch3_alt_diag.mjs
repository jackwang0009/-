// 通道 3 · 收口前的现状盘点：这份只读不写站，用来回答三个问题——
//   1) 盘上的数据到底覆盖哪几个站（派单说 tadu+shuqi，脚本看起来只有 tadu）
//   2) 396 本空简介/空字数是不是同一批书（若是，指向同一个选择器）
//   3) 这 396 本有没有共同特征（分类/字数档/id 段），据此定「选择器漂了」还是「站上没有」
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));

const byId = new Map(cand.books.map((b) => [b.id, b]));
const ids = Object.keys(pages);

console.log("=== 候选池 ===");
console.log(`poolSize=${cand.poolSize} requests=${cand.requests} cats=${cand.cats.join("/")}`);
const catCount = {};
for (const b of cand.books) catCount[b.cat] = (catCount[b.cat] ?? 0) + 1;
console.log("按分类:", JSON.stringify(catCount));
console.log("候选池样本:", JSON.stringify(cand.books[0], null, 1));

console.log("\n=== 书页缓存 ===");
console.log(`条目 ${ids.length}`);
const err = ids.filter((id) => pages[id].error);
console.log(`error 条目 ${err.length}`);
const keys = new Set();
for (const id of ids) for (const k of Object.keys(pages[id])) keys.add(k);
console.log("出现过的字段:", [...keys].join(", "));

const noAbs = ids.filter((id) => !pages[id].error && !pages[id].abstract);
const noWc = ids.filter((id) => !pages[id].error && !pages[id].wordCount);
const noTag = ids.filter((id) => !pages[id].error && !(pages[id].tags ?? []).length);
const noPop = ids.filter((id) => !pages[id].error && !pages[id].popularityRaw);
const noCh = ids.filter((id) => !pages[id].error && !pages[id].chapterTotal);
const noDate = ids.filter((id) => !pages[id].error && !pages[id].lastUpdateDate);
console.log(
  `空简介 ${noAbs.length} / 空字数 ${noWc.length} / 空标签 ${noTag.length} / 空人气 ${noPop.length} / 空章数 ${noCh.length} / 空更新日 ${noDate.length}`,
);

const sa = new Set(noAbs);
const sw = new Set(noWc);
const both = noAbs.filter((id) => sw.has(id));
console.log(`空简介∩空字数 = ${both.length}（若等于两者本身，则是同一批书）`);
console.log(`只空简介不空字数 ${noAbs.filter((id) => !sw.has(id)).length}，只空字数不空简介 ${noWc.filter((id) => !sa.has(id)).length}`);

console.log("\n=== 空字段那批的共同特征 ===");
const featureOf = (list, name) => {
  const c = {};
  for (const id of list) {
    const b = byId.get(id);
    c[b?.[name] ?? "(不在候选池)"] = (c[b?.[name] ?? "(不在候选池)"] ?? 0) + 1;
  }
  return c;
};
console.log("空批·分类:", JSON.stringify(featureOf(both, "cat")));
console.log("全体·分类:", JSON.stringify(featureOf(ids, "cat")));
console.log("空批·状态:", JSON.stringify(featureOf(both, "status")));
console.log("全体·状态:", JSON.stringify(featureOf(ids, "status")));
const hasListWc = both.filter((id) => byId.get(id)?.wordCount != null).length;
console.log(`空批里「列表页有字数」的 ${hasListWc}/${both.length}（列表页有、书页没有 ⇒ 书页选择器问题，不是站上没有）`);

const idNum = (a) => Number(a);
const spanOf = (l) => `${Math.min(...l.map(idNum))}–${Math.max(...l.map(idNum))}`;
console.log(`空批 id 区间 ${spanOf(both)}；全体 id 区间 ${spanOf(ids)}`);

console.log("\n空批前 5 本:");
for (const id of both.slice(0, 5)) {
  const b = byId.get(id);
  console.log(`  ${id} [${b?.cat}] ${b?.title} — ${b?.author} 列表页字数=${b?.wordCount} 缓存=${JSON.stringify(pages[id])}`);
}
console.log("\n非空批前 3 本:");
for (const id of ids.filter((i) => !sa.has(i)).slice(0, 3)) {
  const b = byId.get(id);
  const p = pages[id];
  console.log(`  ${id} [${b?.cat}] ${b?.title} 字数=${p.wordCount} 人气=${p.popularityRaw} 章数=${p.chapterTotal} 标签=${(p.tags ?? []).join(",")} 简介${(p.abstract ?? "").length}字`);
}
