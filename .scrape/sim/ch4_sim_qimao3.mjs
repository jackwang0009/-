// 通道 4 / 阶段 1c：反向召回。
// 前两轮都是「搜模拟词」，只能捞到七猫搜索引擎认为与模拟相关的书。
// 但入选集里有 5 本是「仅简介命中」型——模拟只写在 intro 里、没进书名。这类书在搜「模拟」时
// 排不上来，等于系统性漏采。故这一轮反过来：搜修仙词，再对结果做模拟词过滤。
// 通道 1 已明确本格密度直接决定全报告样本量（起点/QQ阅读/知乎三家已出局），值得多跑一轮。
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

// 修仙侧词表（条件 B 的词），用来把「模拟只在简介里」的那批书从修仙面捞出来
const KEYWORDS = [
  "杂役", "筑基", "金丹", "元婴", "灵根", "长生", "宗门", "炼气", "化神", "仙门", "凡人修仙", "苟道",
];
const MAX_PAGE = 8;
// 只有过条件 A 的才值得并进池子，否则会把整个七猫修仙区拖进来
const SIM = ["模拟器", "人生模拟", "模拟", "推演", "演算", "沙盘", "预演", "重开", "无限重生"];

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

const strip = (s) => String(s ?? "").replace(/\u3000/g, " ").trim().replace(/<[^>]+>/g, "");
const passesA = (b) => {
  const hay = strip(b.title) + "\n" + String(b.intro ?? "");
  return SIM.some((w) => hay.includes(w));
};

log(`\n===== ch4 qimao reverse-recall @ ${new Date().toISOString()} =====`);

const existing = readJson(POOL, []);
const pool = new Map(existing.map((b) => [String(b.book_id), b]));
const before = pool.size;
log(`既有命中池：${before} 本`);
let requests = 0;
let seen = 0;

for (const kw of KEYWORDS) {
  let addedForKw = 0;
  let seenForKw = 0;
  let total = null;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const d = await apiGet(EP(kw, page));
    requests++;
    await sleep(1200);
    const list = d?.data?.search_list ?? [];
    if (total === null) total = Number(d?.data?.page_data?.count ?? 0);
    if (!list.length) break;
    for (const b of list) {
      seenForKw++;
      const id = String(b.book_id ?? "");
      if (!id) continue;
      // 反向轮只收过条件 A 的，避免把整个修仙区灌进池子
      if (!pool.has(id)) {
        if (!passesA(b)) continue;
        pool.set(id, { ...b, _hitBy: [], _source: EP(kw, page) });
        addedForKw++;
      }
      const rec = pool.get(id);
      rec._hitBy ??= [];
      const tag = `rev:${kw}`;
      if (!rec._hitBy.includes(tag)) rec._hitBy.push(tag);
    }
    if (total && page * 15 >= total) break;
  }
  seen += seenForKw;
  log(`[${kw.padEnd(10)}] count=${String(total).padStart(5)}  看过 ${String(seenForKw).padStart(3)} 条  +${addedForKw} 本过条件A的新书  pool=${pool.size}`);
}

writeJson(POOL, [...pool.values()]);
log(`\n反向召回：池 ${before} -> ${pool.size}（+${pool.size - before}），${requests} 次请求，扫过 ${seen} 条结果`);
log(`===== reverse-recall done =====`);
