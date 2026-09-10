import fs from "node:fs";
import { readJson, writeJson } from "./lib.mjs";

// 榜单接口书名 98% 被 PUA 混淆，书页 __INITIAL_STATE__ 干净。
// 这里拿 360 本书页的干净书名，回头精确匹配底本第 1-30 条。
const books = Object.values(readJson(".scrape/fq_books.json", {})).filter((b) => !b._err);

const norm = (s) =>
  String(s ?? "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/[\s，,。.！!？?：:；;、·—－\-～~「」『』《》（）()【】\[\]"'"'']/g, "")
    .toLowerCase();

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

const byName = new Map();
for (const b of books) {
  const k = norm(b.bookName);
  if (k) byName.set(k, [...(byName.get(k) ?? []), b]);
}

const exact = [], partial = [], miss = [];
for (const f of rows) {
  const [seq, name, author] = f;
  const k = norm(name);

  const hit = byName.get(k);
  if (hit?.length === 1) { exact.push({ seq, name, b: hit[0], how: "书名精确" }); continue; }
  if (hit?.length > 1) {
    const byAuthor = author ? hit.filter((b) => norm(b.author) === norm(author)) : [];
    if (byAuthor.length === 1) { exact.push({ seq, name, b: byAuthor[0], how: "书名+作者" }); continue; }
    partial.push({ seq, name, cands: hit.map((b) => `${b.bookId} ${b.bookName} / ${b.author}`) });
    continue;
  }

  // 底本书名可能是缩写或讹写，做包含匹配；作者一致才采信
  const sub = books.filter((b) => {
    const bk = norm(b.bookName);
    return bk.length > 3 && k.length > 3 && (bk.includes(k) || k.includes(bk));
  });
  const subByAuthor = author ? sub.filter((b) => norm(b.author) === norm(author)) : [];
  if (subByAuthor.length === 1) { exact.push({ seq, name, b: subByAuthor[0], how: "包含+作者" }); continue; }
  if (sub.length) { partial.push({ seq, name, cands: sub.slice(0, 4).map((b) => `${b.bookId} ${b.bookName} / ${b.author}`) }); continue; }
  miss.push({ seq, name });
}

const out = [];
out.push(`书页索引 ${books.length} 本（干净书名，0 含 PUA）`);
out.push(`底本番茄 30 本：精确 ${exact.length}｜需人工判 ${partial.length}｜索引内无此书 ${miss.length}\n`);
out.push("=== 精确命中 ===");
for (const e of exact) {
  const b = e.b;
  out.push([
    e.seq, b.bookName, b.author, b.bookId,
    (b.wordNumber / 10000).toFixed(1) + "万",
    b.creationStatus === "0" ? "已完结" : "连载中",
    (b.categories ?? []).map((c) => c.name).join("/"),
    b.chapterTotal + "章",
    "read=" + b.readCount,
    e.how,
  ].join(" | "));
}
out.push("\n=== 需人工判（多候选）===");
for (const p of partial) out.push(`${p.seq} ${p.name}\n    ${p.cands.join("\n    ")}`);
out.push("\n=== 索引内无此书 ===");
for (const m of miss) out.push(`${m.seq} ${m.name}`);

fs.writeFileSync(".scrape/fq_final_match.txt", out.join("\n"), "utf8");
writeJson(".scrape/fq_final_match.json", { exact, partial, miss });
console.log(`精确 ${exact.length}｜需人工判 ${partial.length}｜无此书 ${miss.length}`);
