// 通道 4 / 阶段 1b：补召回。
// SCHEMA 修订 3 拆掉了 40–80 本上限，改「凡过判据的全收」，理由正是七猫单条就带回全字段、
// 多收一本边际请求为零。既然如此，召回率就成了唯一的短板——补一批复合词再翻一遍，
// 结果并入既有命中池（不覆盖）。
import { sleep, readJson, writeJson } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const POOL = ".scrape/sim/ch4_qm_hits.json";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const EP = (kw, page) =>
  `https://api-www.qimao.com/api/search/result?keyword=${encodeURIComponent(kw)}&page=${page}`;

// 单字模糊词已在阶段 1 跑过；这里补「模拟 × 修仙」交叉的复合词，专打前一轮召不回来的长尾
const KEYWORDS = [
  "模拟修仙", "修仙模拟", "模拟长生", "推演长生", "推演功法", "模拟人生修仙",
  "重生模拟", "轮回模拟", "无限模拟", "模拟器修真", "演算天机", "推演大道",
];
const MAX_PAGE = 8;

async function apiGet(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9",
          Referer: "https://www.qimao.com/search/index/",
        },
      });
      const body = await res.text();
      if (res.status === 403 || res.status === 429 || body.length === 0) {
        log(`  [throttled ${res.status || "empty-200"}] backing off 60s`);
        await sleep(60000);
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return JSON.parse(body);
    } catch (e) {
      log(`  [retry ${i + 1}] ${e.message}`);
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

log(`\n===== ch4 qimao supplement @ ${new Date().toISOString()} =====`);

const existing = readJson(POOL, []);
const pool = new Map(existing.map((b) => [String(b.book_id), b]));
log(`既有命中池：${pool.size} 本`);
const before = pool.size;
let requests = 0;

for (const kw of KEYWORDS) {
  let total = null;
  let addedForKw = 0;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const d = await apiGet(EP(kw, page));
    requests++;
    await sleep(1200);
    const list = d?.data?.search_list ?? [];
    if (total === null) total = Number(d?.data?.page_data?.count ?? 0);
    if (!list.length) break;
    for (const b of list) {
      const id = String(b.book_id ?? "");
      if (!id) continue;
      if (!pool.has(id)) {
        pool.set(id, { ...b, _hitBy: [], _source: EP(kw, page) });
        addedForKw++;
      }
      const rec = pool.get(id);
      rec._hitBy ??= [];
      if (!rec._hitBy.includes(kw)) rec._hitBy.push(kw);
    }
    if (total && page * 15 >= total) break;
  }
  log(`[${kw.padEnd(12)}] count=${String(total).padStart(4)}  +${addedForKw} new  pool=${pool.size}`);
}

writeJson(POOL, [...pool.values()]);
log(`\n补召回：${before} -> ${pool.size} 本（+${pool.size - before}），${requests} 次请求`);
log(`===== supplement done =====`);
