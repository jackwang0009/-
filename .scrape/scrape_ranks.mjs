import fs from "node:fs";
import { get, extractState, sleep, CATS, readJson, writeJson } from "./lib.mjs";

const TARGETS = [
  // [categoryId, rankType]  rankType 1 = 新书榜, 2 = 阅读榜
  [258, 1], [257, 1], [1140, 1], [1141, 1], [124, 1], [1014, 1],
  [258, 2], [257, 2], [1140, 2], [1141, 2], [124, 2], [1014, 2],
];
const RANK_NAME = { 1: "新书榜", 2: "阅读榜" };

const ranks = readJson(".scrape/ranks.json", {});
const log = [];

for (const [cat, rt] of TARGETS) {
  const key = `1_${rt}_${cat}`;
  if (ranks[key]) { log.push(`skip ${key} (cached)`); continue; }
  try {
    const html = await get(`https://fanqienovel.com/rank/${key}`);
    const st = extractState(html);
    const list = st?.rank?.book_list ?? [];
    ranks[key] = {
      key,
      categoryId: cat,
      categoryName: CATS[cat],
      rankType: rt,
      rankName: `${CATS[cat]}${RANK_NAME[rt]}`,
      rankVersion: st?.rank?.rankVersion,
      totalNum: st?.rank?.total_num,
      fetchedAt: new Date().toISOString(),
      books: list.map((b) => ({
        bookId: b.bookId,
        pos: b.currentPos,
        posDiff: b.rankPosDiff,
        readCount: Number(b.read_count || b.readCount || 0),
        wordNumber: Number(b.wordNumber || 0),
        creationStatus: b.creationStatus,
        lastChapterTitle: b.lastChapterTitle,
        lastChapterUpdateTime: b.lastChapterUpdateTime,
      })),
    };
    log.push(`OK ${key} ${CATS[cat]}${RANK_NAME[rt]} -> ${list.length} books (total_num=${st?.rank?.total_num})`);
    writeJson(".scrape/ranks.json", ranks);
    await sleep(1200);
  } catch (e) {
    log.push(`ERR ${key} ${e.message}`);
  }
}

const ids = new Set();
for (const r of Object.values(ranks)) for (const b of r.books) ids.add(b.bookId);
log.push(`\nunique bookIds: ${ids.size}`);
writeJson(".scrape/bookids.json", [...ids]);
fs.writeFileSync(".scrape/scrape_ranks.log", log.join("\n"), "utf8");
