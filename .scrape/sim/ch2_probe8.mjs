// 探测八：决定性问题——library/book_list 返回的 abstract 是不是也被私有字体(PUA)混淆了？
// 若 abstract 干净，条件 A 可以在列表层零额外请求地筛；若脏，就只能逐本 /api/book/info。
import fs from "node:fs";

const j = JSON.parse(fs.readFileSync(".scrape/sim/raw/ch2_probe_lib_lib-a.json", "utf8"));
const list = j.data.book_list;

const PUA = /[\uE000-\uF8FF]/g;
const puaRatio = (s) => {
  s = String(s ?? "");
  if (!s.length) return 0;
  return (s.match(PUA) || []).length / s.length;
};

console.log(`共 ${list.length} 本\n`);
const fields = ["book_name", "author", "abstract", "word_count", "read_count", "creation_status", "last_chapter_time", "book_id"];
const agg = {};
for (const f of fields) agg[f] = { dirty: 0, total: 0 };

for (const b of list) {
  for (const f of fields) {
    const r = puaRatio(b[f]);
    agg[f].total++;
    if (r > 0) agg[f].dirty++;
  }
}
console.log("字段 PUA 污染率：");
for (const f of fields) console.log(`  ${f.padEnd(18)} ${agg[f].dirty}/${agg[f].total}`);

console.log("\n前 3 本逐字段抽样（PUA 用 · 替换后展示，长度截断）：");
const clean = (s) => String(s ?? "").replace(PUA, "·");
for (const b of list.slice(0, 3)) {
  console.log(`\n  book_id=${b.book_id}`);
  console.log(`  book_name = ${clean(b.book_name)}   (pua=${(puaRatio(b.book_name) * 100).toFixed(0)}%)`);
  console.log(`  author    = ${clean(b.author)}`);
  console.log(`  word_count= ${clean(b.word_count)}   read_count=${clean(b.read_count)}`);
  console.log(`  status    = ${b.creation_status}  last_chapter_time=${b.last_chapter_time}`);
  console.log(`  abstract  = ${clean(b.abstract).slice(0, 120)}...   (pua=${(puaRatio(b.abstract) * 100).toFixed(0)}%, len=${String(b.abstract).length})`);
}
