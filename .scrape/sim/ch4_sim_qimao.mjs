// 通道 4 / 阶段 1：七猫收割。
// 只有搜索 API 可用（HTML 全线 WAF），所以入口就是站内搜多关键词 + 深翻页，
// 拿不到的字段一律 null，不猜。产物：.scrape/sim/ch4_qm_hits.json（原始命中池，未判据过滤）
import { sleep } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const OUT = ".scrape/sim/ch4_qm_hits.json";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const EP = (kw, page) =>
  `https://api-www.qimao.com/api/search/result?keyword=${encodeURIComponent(kw)}&page=${page}`;

// 条件 A 的词表，直接照 SCHEMA 第一节
const KEYWORDS = ["模拟", "模拟器", "推演", "演算", "沙盘", "预演", "重开", "人生模拟", "无限重生"];
const MAX_PAGE = 18;

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
      // 抓取纪律：403/429/200 空 body 一律退避 60 秒
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

log(`\n===== ch4 qimao harvest @ ${new Date().toISOString()} =====`);

const pool = new Map(); // book_id -> { ...record, _hitBy:Set, _source }
let requests = 0;

for (const kw of KEYWORDS) {
  let total = null;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const d = await apiGet(EP(kw, page));
    requests++;
    await sleep(1200);
    const list = d?.data?.search_list ?? [];
    if (total === null) {
      total = Number(d?.data?.page_data?.count ?? 0);
      log(`\n[${kw}] count=${total}`);
    }
    if (!list.length) {
      log(`  page ${page}: empty -> stop`);
      break;
    }
    let fresh = 0;
    for (const b of list) {
      const id = String(b.book_id ?? "");
      if (!id) continue;
      if (!pool.has(id)) {
        pool.set(id, { ...b, _hitBy: [], _source: EP(kw, page) });
        fresh++;
      }
      const rec = pool.get(id);
      if (!rec._hitBy.includes(kw)) rec._hitBy.push(kw);
    }
    log(`  page ${page}: ${list.length} rows, +${fresh} new, pool=${pool.size}`);
    if (total && page * 15 >= total) break;
  }
}

const arr = [...pool.values()];
fs.writeFileSync(OUT, JSON.stringify(arr, null, 1), "utf8");
log(`\n七猫命中池：${arr.length} 本（去重后），${requests} 次请求 -> ${OUT}`);
log(`===== qimao harvest done =====`);
