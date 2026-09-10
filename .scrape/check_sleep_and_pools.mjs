import fs from "node:fs";
import { sleep, readJson, parseCsv } from "./lib.mjs";

// 1) 实测 sleep 是否还会提前触发
let min = Infinity;
for (let i = 0; i < 5; i++) {
  const t = Date.now();
  await sleep(1100);
  min = Math.min(min, Date.now() - t);
}
console.log(`sleep(1100) 最小实测间隔 = ${min}ms  ${min >= 1100 ? "OK 未跌破" : "仍偏早!"}`);

// 2) 把本地几个池子里所有 bookName->bookId 的线索翻出来
const norm = (s) =>
  String(s ?? "").replace(/[\s，,。.！!？?、·:：""''《》()（）[\]【】\-—_~]/g, "").toLowerCase();
const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));

const csv = parseCsv(fs.readFileSync("docs/玄幻选题库-100本-20260826.csv", "utf8"));
const missingNos = [1, 10, 11, 12, 13, 16, 18, 19, 20, 22, 23, 24, 25, 26, 28, 30];
const want = new Map();
for (const r of csv.slice(1)) {
  if (missingNos.includes(Number(r[0]))) want.set(norm(r[1]), { no: Number(r[0]), title: r[1] });
}

const pool = new Map(); // norm(name) -> Set(id)
let scanned = 0;
function consider(name, id, src) {
  if (!name || !id) return;
  scanned++;
  const k = norm(name);
  if (!pool.has(k)) pool.set(k, new Map());
  pool.get(k).set(String(id), src);
}
function walk(o, src) {
  if (Array.isArray(o)) return o.forEach((v) => walk(v, src));
  if (!o || typeof o !== "object") return;
  const id = o.bookId ?? o.book_id;
  const nm = o.bookName ?? o.book_name ?? o.title;
  if (id && nm) consider(nm, id, src);
  for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, src);
}

for (const f of ["merged.json", "books.json", "ranks.json", "ranks_ext.json", "detail.json", "zh_all.json", "qm_all.json", "qm_hot_date.json", "qm_new_date.json", "zh_rt4.json", "zh_rt9.json"]) {
  const p = `.scrape/${f}`;
  if (!fs.existsSync(p)) continue;
  try { walk(readJson(p, null), f); } catch (e) { console.log(`  (${f} 解析失败 ${e.message})`); }
}
console.log(`\n扫描到带「名+ID」的条目 ${scanned} 条，去重书名 ${pool.size} 个`);

console.log("\n--- 16 条缺口在本地池子里的命中情况 ---");
let hit = 0;
for (const [k, v] of want) {
  const m = pool.get(k);
  if (m && m.size) {
    hit++;
    console.log(`  命中 #${v.no} ${v.title} -> ${[...m.entries()].map(([id, s]) => `${id}(${s})`).join(", ")}`);
  } else {
    console.log(`  未命中 #${v.no} ${v.title}`);
  }
}
console.log(`\n合计命中 ${hit}/16`);
