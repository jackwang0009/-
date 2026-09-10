// 把底本 1-30 条书名对到番茄 bookId。
// 榜单里的书名被私有字体混淆（PUA 区），本脚本**不猜字**：
// 只做「同长度 + 所有非 PUA 位字符逐位相等」的骨架校验，命中后再拿官方书页的干净书名复核。
import fs from "node:fs";
import { readJson, writeJson, parseCsv } from "./lib.mjs";

const isPUA = (ch) => ch >= "\uE000" && ch <= "\uF8FF";
const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));
// 干净书名比对时忽略标点/空白差异；骨架比对仍走严格逐位，不做归一化
const norm = (s) =>
  String(s ?? "")
    .replace(/[\s，,。.！!？?、·:：""''《》()（）[\]【】\-—_~]/g, "")
    .toLowerCase();

// 骨架匹配：raw 与 want 等长，且 raw 中每个非 PUA 位都与 want 同位相等
export function skeletonMatch(want, raw) {
  const a = String(want ?? ""), b = String(raw ?? "");
  if (!a || !b || a.length !== b.length) return false;
  let puaCount = 0;
  for (let i = 0; i < b.length; i++) {
    if (isPUA(b[i])) { puaCount++; continue; }
    if (b[i] !== a[i]) return false;
  }
  return puaCount < b.length;
}

const csv = parseCsv(fs.readFileSync("docs/玄幻选题库-100本-20260826.csv", "utf8"));
const base = csv.slice(1).filter((r) => r.length > 1 && Number(r[0]) >= 1 && Number(r[0]) <= 30);

// 候选池：扩展榜单（含 PUA 原名） + 已抓到的书页（干净名）
const pool = new Map(); // bookId -> {bookId, nameRaw, authorRaw, cleanName, cleanAuthor}
for (const r of Object.values(readJson(".scrape/ranks_ext.json", {}))) {
  for (const b of r.books) {
    if (!pool.has(b.bookId)) pool.set(b.bookId, { bookId: b.bookId, nameRaw: b.bookNameRaw, authorRaw: b.authorRaw });
  }
}
for (const [id, b] of Object.entries(readJson(".scrape/books.json", {}))) {
  if (b._err) continue;
  const e = pool.get(id) || { bookId: id };
  e.cleanName = b.bookName;
  e.cleanAuthor = b.author;
  pool.set(id, e);
}

const resolved = {}, ambiguous = [], missing = [];
for (const r of base) {
  const [no, title, authorBase] = r;
  const hits = [];
  for (const e of pool.values()) {
    const cleanExact = e.cleanName && !hasPUA(e.cleanName) && norm(e.cleanName) === norm(title);
    const rawExact = e.nameRaw && !hasPUA(e.nameRaw) && norm(e.nameRaw) === norm(title);
    const skel = e.nameRaw && hasPUA(e.nameRaw) && skeletonMatch(title, e.nameRaw);
    if (cleanExact || rawExact || skel) {
      hits.push({ ...e, how: cleanExact ? "书页干净名精确" : rawExact ? "榜单干净名精确" : "榜单骨架匹配" });
    }
  }
  if (hits.length === 1) resolved[no] = { no, title, authorBase, ...hits[0] };
  else if (hits.length > 1) ambiguous.push({ no, title, hits });
  else missing.push({ no, title, authorBase });
}

writeJson(".scrape/id_map2.json", { resolved, ambiguous, missing, poolSize: pool.size });
console.log(`pool=${pool.size} resolved=${Object.keys(resolved).length} ambiguous=${ambiguous.length} missing=${missing.length}`);
console.log("\n-- resolved --");
for (const v of Object.values(resolved)) console.log(`  #${v.no} ${v.title} -> ${v.bookId} [${v.how}]`);
console.log("\n-- ambiguous --");
for (const a of ambiguous) console.log(`  #${a.no} ${a.title} -> ${a.hits.map((h) => h.bookId).join(", ")}`);
console.log("\n-- missing --");
for (const m of missing) console.log(`  #${m.no} ${m.title}`);
