// 阶段 2：零请求。在本地 360 本番茄榜单种子里过一遍模拟/修仙关键词，
// 产出候选 bookId 池给阶段 3 的书页抓取用。
import { readJson, writeJson } from "../lib.mjs";

export const SIM_KW = [
  "模拟器", "模拟", "推演", "演算", "沙盘", "预演", "重开", "人生模拟", "无限重生",
];
export const CULT_KW = [
  "修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道",
  "仙侠", "玄幻", "洪荒", "长生", "仙帝", "仙尊", "剑修", "散修", "道尊",
];
// 分类维度上算「修仙属性」的分类名
export const CULT_CATS = [
  "东方仙侠", "传统玄幻", "玄幻脑洞", "都市修真", "洪荒", "仙侠", "修真", "东方玄幻",
];

export const hitAny = (text, kws) => kws.filter((k) => String(text ?? "").includes(k));

const seeds = readJson(".scrape/fq_books.json", {});
const arr = Array.isArray(seeds) ? seeds : Object.values(seeds);

const cand = [];
for (const b of arr) {
  const catNames = (b.categories ?? []).map((c) => c.name);
  const titleHit = hitAny(b.bookName, SIM_KW);
  const tagHit = [...new Set(catNames.flatMap((n) => hitAny(n, SIM_KW)))];
  // metaKw 只是书名的 SEO 堆叠，不是独立证据，仅用来兜住 PUA 混淆的书名
  if (titleHit.length || tagHit.length) {
    cand.push({
      bookId: String(b.bookId),
      bookName: b.bookName,
      seedMatchedIn: [titleHit.length && "title", tagHit.length && "tag"].filter(Boolean),
      seedKeywords: [...new Set([...titleHit, ...tagHit])],
      seedCats: catNames,
      source: "local:.scrape/fq_books.json",
    });
  }
}

writeJson(".scrape/sim/ch2_seed_hits.json", cand);
console.log(`种子 ${arr.length} 本，命中模拟词 ${cand.length} 本`);
for (const c of cand) {
  console.log(`  ${c.bookId}  ${c.bookName}  [${c.seedMatchedIn}] ${c.seedKeywords} | ${c.seedCats.join("/")}`);
}

// 顺带统计：种子里有多少本落在四个重点修仙分类，供阶段 3 决定要不要全量补抓书页
const inCult = arr.filter((b) => (b.categories ?? []).some((c) => CULT_CATS.includes(c.name)));
console.log(`\n种子里属于修仙类分类的：${inCult.length} 本（这些即使书名没命中，简介也可能命中，阶段 3 要抓书页）`);
writeJson(".scrape/sim/ch2_seed_cult_ids.json", inCult.map((b) => String(b.bookId)));
