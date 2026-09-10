import fs from "node:fs";
import { readJson, writeJson, CATS } from "./lib.mjs";

// 番茄榜单接口返回的书名有 98% 被私有字体混淆（PUA 区），名字匹配不可用。
// 改用三个不受混淆影响的信号：分类、榜位、在读数。
// test() 用不带 g 的正则：带 g 时 lastIndex 会在调用间推进，连续判定会给出错误结果
const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));

const rawBoards = readJson(".scrape/ranks_ext.json", []);
const boards = Array.isArray(rawBoards) ? rawBoards : Object.values(rawBoards);

const entries = [];
for (const b of boards) {
  const [, rankType, catId] = String(b.key).split("_");
  for (const x of b.books ?? []) {
    if (!x.bookId) continue;
    entries.push({
      ...x,
      catId: Number(catId),
      catName: CATS[Number(catId)] ?? `cat${catId}`,
      rankType: Number(rankType),
    });
  }
}

const parse = (line) => {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

const rows = fs.readFileSync("docs/玄幻选题库-100本-20260826.csv", "utf8")
  .split(/\r?\n/).slice(1).map(parse)
  .filter((f) => f.length > 3 && Number(f[0]) >= 1 && Number(f[0]) <= 30);

const resolved = [], unresolved = [];
for (const f of rows) {
  const [seq, name, , , , , , snapshot] = f;
  // 「传统玄幻榜 #1 · 132.6 万在读」-> 1326000
  const m = /([\d.]+)\s*万在读/.exec(snapshot ?? "");
  if (!m) { unresolved.push({ seq, name, why: "底本无在读数，无法用数值匹配" }); continue; }
  const want = Math.round(Number(m[1]) * 10000);

  const scored = entries
    .map((e) => ({ e, diff: Math.abs(Number(e.readCount || 0) - want) / want }))
    .filter((s) => s.diff < 0.03)
    .sort((a, b) => a.diff - b.diff);

  const uniq = [];
  for (const s of scored) if (!uniq.some((u) => u.e.bookId === s.e.bookId)) uniq.push(s);

  if (!uniq.length) { unresolved.push({ seq, name, why: `无 readCount 落在 ${want} ±3% 内` }); continue; }
  resolved.push({
    seq, name, want,
    bookId: uniq[0].e.bookId,
    readCount: uniq[0].e.readCount,
    diff: (uniq[0].diff * 100).toFixed(2) + "%",
    cat: uniq[0].e.catName,
    pos: uniq[0].e.pos,
    nameRaw: uniq[0].e.bookNameRaw,
    namePUA: hasPUA(uniq[0].e.bookNameRaw),
    thumbUri: uniq[0].e.thumbUri ?? "",
    ambiguous: uniq.length > 1 ? uniq.length : 0,
  });
}

console.log(`榜单条目 ${entries.length}，去重 ${new Set(entries.map((e) => e.bookId)).size} 本`);
console.log(`底本番茄 30 本：数值匹配命中 ${resolved.length}，待解 ${unresolved.length}\n`);
console.log("--- 命中（序号 书名 -> bookId  在读 偏差 分类#榜位）---");
for (const r of resolved) {
  console.log(`${r.seq}\t${r.name}\t-> ${r.bookId}  ${r.readCount}  ${r.diff}  ${r.cat}#${r.pos}${r.ambiguous ? `  [${r.ambiguous}个候选]` : ""}`);
}
console.log("\n--- 待解 ---");
for (const u of unresolved) console.log(`${u.seq}\t${u.name}\t(${u.why})`);

writeJson(".scrape/fq_match.json", { resolved, unresolved });
writeJson(".scrape/fq_ids.json", resolved.map((r) => r.bookId));
