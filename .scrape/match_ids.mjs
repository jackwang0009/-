// 用已抓到的番茄书页元数据建 书名->bookId 索引，再把底本第 1-30 条对上去。
// 只做「精确匹配」：归一化后完全相等才算命中，绝不拿相似书名充数。
import fs from "node:fs";
import { readJson, writeJson, parseCsv } from "./lib.mjs";

const norm = (s) =>
  String(s ?? "")
    .replace(/[\s，,。.！!？?、·:：""''《》()（）\[\]【】\-—_~]/g, "")
    .toLowerCase();

const csv = parseCsv(fs.readFileSync("docs/玄幻选题库-100本-20260826.csv", "utf8"));
const head = csv[0];
const base = csv.slice(1).filter((r) => r.length > 1 && Number(r[0]) >= 1 && Number(r[0]) <= 30);

const books = readJson(".scrape/books.json", {});
const index = new Map();
for (const [id, b] of Object.entries(books)) {
  if (b._err || !b.bookName) continue;
  const k = norm(b.bookName);
  if (!index.has(k)) index.set(k, []);
  index.get(k).push({ id, name: b.bookName, author: b.author });
}

const resolved = {}, unresolved = [];
for (const r of base) {
  const no = r[0], title = r[1];
  const hit = index.get(norm(title)) || [];
  if (hit.length === 1) resolved[no] = { title, bookId: hit[0].id, via: "rank-index", matched: hit[0].name };
  else if (hit.length > 1) unresolved.push({ no, title, why: `索引内 ${hit.length} 个同名候选`, cands: hit });
  else unresolved.push({ no, title, why: "榜单索引内无同名书" });
}

writeJson(".scrape/id_map.json", { resolved, unresolved, indexSize: index.size });
console.log(`base=${base.length} indexed=${index.size} resolved=${Object.keys(resolved).length} unresolved=${unresolved.length}`);
for (const u of unresolved) console.log(`  #${u.no} ${u.title} -- ${u.why}`);
console.log("(head)", head.join(" | "));
