// 步骤 A：用 /api/library/book_list 把候选 bookId 枚举出来。
// 列表接口的文本字段全被私有字体混淆（abstract 29–48% PUA），所以这里**只取 book_id**
// 和两个干净字段（creation_status / last_chapter_time），书名简介留给步骤 B 的
// /api/book/info 拿干净版本。不做任何字体反解。
import fs from "node:fs";
import { UA, sleep, readJson, writeJson } from "../lib.mjs";

// 条件 B（修仙属性）在分类层就先过一道：只枚举仙侠/玄幻系分类
export const CULT_CATEGORIES = [
  [1140, "东方仙侠"],
  [258, "传统玄幻"],
  [257, "玄幻脑洞"],
  [124, "都市修真"],
  [511, "东方玄幻"],
  [259, "奇幻仙侠"],
  [66, "洪荒"],
  [7, "玄幻"],
];

const PAGE_COUNT = Number(process.env.PAGE_COUNT || 20);
const MAX_PAGES = Number(process.env.MAX_PAGES || 12);
const SORTS = (process.env.SORTS || "0,1").split(",").map(Number);
const OUT = process.env.OUT || ".scrape/sim/ch2_ids.json";
// CATS 形如 "262:都市脑洞,8:科幻末世"；不给就用上面的仙侠/玄幻系
const CATEGORIES = process.env.CATS
  ? process.env.CATS.split(",").map((s) => {
      const [id, name] = s.split(":");
      return [Number(id), name];
    })
  : CULT_CATEGORIES;

const mk = (cat, pi, sort) =>
  "https://fanqienovel.com/api/library/book_list" +
  `?gender=1&category_id=${cat}&creation_status=-1&word_count=-1&sort=${sort}` +
  `&page_index=${pi}&page_count=${PAGE_COUNT}`;

async function api(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "application/json, text/plain, */*", Referer: "https://fanqienovel.com/" },
      });
      if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
      const body = await res.text();
      if (!body.length) { const e = new Error("empty body"); e.softLimit = true; throw e; }
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
      const throttled = e.status === 403 || e.status === 429 || e.softLimit;
      if (throttled) console.warn(`  [throttled ${e.status ?? "empty-200"}] backing off 60s`);
      await sleep(throttled ? 60000 : 1500 * (i + 1));
    }
  }
  throw lastErr;
}

const pool = readJson(OUT, {});
const log = [];
let added = 0, reqs = 0;

for (const [cat, catName] of CATEGORIES) {
  for (const sort of SORTS) {
    for (let pi = 0; pi < MAX_PAGES; pi++) {
      let j;
      try {
        j = await api(mk(cat, pi, sort));
        reqs++;
      } catch (e) {
        log.push(`ERR cat=${cat} sort=${sort} page=${pi} ${e.message}`);
        break;
      }
      const d = j.data || {};
      const list = d.book_list || [];
      let fresh = 0;
      for (const b of list) {
        const id = String(b.book_id);
        if (!id || id === "undefined") continue;
        if (!pool[id]) {
          pool[id] = {
            bookId: id,
            creationStatusRaw: String(b.creation_status ?? ""),
            lastChapterTime: Number(b.last_chapter_time || 0),
            foundIn: [],
          };
          fresh++; added++;
        }
        const src = `${catName}(${cat}) sort=${sort}`;
        if (!pool[id].foundIn.includes(src)) pool[id].foundIn.push(src);
      }
      const line = `cat=${catName}(${cat}) sort=${sort} page=${pi} n=${list.length} fresh=${fresh} has_more=${d.has_more} pool=${Object.keys(pool).length}`;
      console.log(line);
      log.push(line);
      writeJson(OUT, pool);
      if (!list.length || !d.has_more) break;
      await sleep(1200);
    }
    await sleep(1200);
  }
}

writeJson(OUT, pool);
const summary = `\n步骤A完成：请求 ${reqs} 次，新增 ${added}，ID 池共 ${Object.keys(pool).length}`;
console.log(summary);
fs.appendFileSync(".scrape/sim/ch2.log", log.join("\n") + summary + "\n", "utf8");
