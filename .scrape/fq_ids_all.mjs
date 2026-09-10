import { readJson, writeJson } from "./lib.mjs";

// 番茄榜单接口的书名 98% 被私有字体混淆，按名字反查 ID 不可行。
// 改为把所有已知的番茄 bookId 汇总，逐本抓书页（书页 __INITIAL_STATE__ 里的书名是干净的），
// 拿到真名后再回头匹配底本那 30 本。
const ids = new Set();

const rawBoards = readJson(".scrape/ranks_ext.json", []);
for (const b of Array.isArray(rawBoards) ? rawBoards : Object.values(rawBoards)) {
  for (const x of b.books ?? []) if (x.bookId) ids.add(String(x.bookId));
}

const rawRanks = readJson(".scrape/ranks.json", []);
for (const b of Array.isArray(rawRanks) ? rawRanks : Object.values(rawRanks)) {
  for (const x of b.books ?? []) if (x.bookId) ids.add(String(x.bookId));
}

for (const id of readJson(".scrape/bookids.json", [])) if (id) ids.add(String(id));

const out = [...ids];
writeJson(".scrape/fq_ids_all.json", out);
console.log(`汇总番茄 bookId ${out.length} 个，预计耗时 ${Math.ceil((out.length * 1.3) / 60)} 分钟`);
