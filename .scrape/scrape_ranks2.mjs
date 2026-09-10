// 扩大番茄官方榜单覆盖，顺便把榜单里的 bookName/author 原样存下来（含 PUA 字符）。
// 只读官方榜单页，不碰正文。
import fs from "node:fs";
import { get, extractState, sleep, readJson, writeJson } from "./lib.mjs";

const MALE_CATS = [
  1141, 1140, 8, 261, 124, 1014, 273, 27, 263, 258, 272, 539, 262, 257, 751, 504, 746, 718, 1016,
];
const RANK_TYPES = [1, 2];

const out = readJson(".scrape/ranks_ext.json", {});
const log = [];

for (const cat of MALE_CATS) {
  for (const rt of RANK_TYPES) {
    const key = `1_${rt}_${cat}`;
    if (out[key]) { log.push(`skip ${key}`); continue; }
    try {
      const html = await get(`https://fanqienovel.com/rank/${key}`);
      const st = extractState(html);
      const list = st?.rank?.book_list ?? [];
      out[key] = {
        key,
        rankTypeText: st?.rank?.rankTypeText,
        totalNum: st?.rank?.total_num,
        fetchedAt: new Date().toISOString(),
        books: list.map((b) => ({
          bookId: b.bookId,
          bookNameRaw: b.bookName,
          authorRaw: b.author,
          pos: b.currentPos,
          readCount: Number(b.read_count || b.readCount || 0),
          wordNumber: Number(b.wordNumber || 0),
          creationStatus: b.creationStatus,
          thumbUri: b.thumbUri,
        })),
      };
      log.push(`OK ${key} ${st?.rank?.rankTypeText ?? ""} -> ${list.length}`);
      writeJson(".scrape/ranks_ext.json", out);
    } catch (e) {
      log.push(`ERR ${key} ${e.message}`);
    }
    await sleep(1200);
  }
}

const ids = new Set();
for (const r of Object.values(out)) for (const b of r.books) ids.add(b.bookId);
log.push(`\nlists=${Object.keys(out).length} uniqueIds=${ids.size}`);
fs.writeFileSync(".scrape/scrape_ranks2.log", log.join("\n"), "utf8");
console.log(log.join("\n"));
