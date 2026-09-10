// 通道 5 采集：纵横中文网。
// 新版 search.zongheng.com 页面是 JS 渲染的（不同关键词返回同样字节数），但它背后的
// search/book 接口直接吐 JSON，字段比 HTML 还全，走接口。
// 点击/推荐要另开书页；首发日期取目录页第一章的时间。
import fs from "node:fs";
import path from "node:path";
import { sleep, writeJson, readJson, UA } from "../lib.mjs";
import { getHtml, strip, toNum, simHit, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const STAGE = path.join(RAW, "ch5_stage_zongheng.json");
const GAP = 1200;

const CULT_CAT = /玄幻|仙侠|武侠|奇幻|修真|洪荒/;
const CULT_TEXT = /修仙|修真|炼气|筑基|金丹|元婴|宗门|灵根|大道/;
const clean = (s) => strip(String(s ?? "").replace(/<[^>]+>/g, ""));

async function search(kw, pageNum) {
  const url = `https://search.zongheng.com/search/book?keyword=${encodeURIComponent(kw)}&pageNum=${pageNum}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://search.zongheng.com/" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const d = j.data?.datas ?? {};
  return { url, list: d.list ?? [], total: d.total ?? 0, totalPage: d.totalPage ?? 1 };
}

// 书页：总点击/总推荐/字数/标签/状态。数值块形如「461.2 万总点击 18.2 万总推荐 10 周推荐 218.7 万字数」
async function bookPage(id) {
  const r = await getHtml(`https://book.zongheng.com/book/${id}.html`, 3);
  const h = r.html;
  const meta = (k) => new RegExp(`<meta[^>]+name="${k}"[^>]*content="([^"]*)"`).exec(h)?.[1] ?? null;
  const flat = strip(h).replace(/\s+/g, " ");
  const num = (label) => toNum(new RegExp(`([\\d.]+\\s*万?)\\s*${label}`).exec(flat)?.[1]);
  return {
    html: h,
    status: meta("og:novel:status"),
    updateTime: meta("og:novel:update_time"),
    category: meta("og:novel:category"),
    author: meta("og:novel:author"),
    cover: meta("og:image"),
    clickTotal: num("总点击"),
    recommendTotal: num("总推荐"),
    wordCount: num("字数"),
    signed: /已签约/.test(flat),
  };
}

// 目录页第一章的时间即首发日期；拿不到写 null，不拿更新时间顶替
async function firstChapterDate(id) {
  for (const url of [`https://book.zongheng.com/showchapter/${id}.html`, `https://read.zongheng.com/showchapter/${id}.html`]) {
    try {
      const r = await getHtml(url, 2);
      const dates = [...r.html.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort();
      if (dates.length) return { date: dates[0], from: url, count: dates.length };
    } catch {
      /* 换下一个候选 URL */
    }
    await sleep(GAP);
  }
  return { date: null, from: null, count: 0 };
}

// —— 主流程 ——
const fresh = process.env.CH5_FRESH === "1";
const stage = fresh ? { cands: {}, books: {}, entryPoints: [] } : readJson(STAGE, { cands: {}, books: {}, entryPoints: [] });

if (!Object.keys(stage.cands).length) {
  for (const kw of ["模拟", "模拟器", "推演", "演算", "沙盘", "预演", "人生模拟", "重开"]) {
    let totalPage = 1;
    for (let p = 1; p <= Math.min(totalPage, 6); p++) {
      try {
        const s = await search(kw, p);
        if (p === 1) {
          totalPage = s.totalPage;
          log(`[zh] 搜索「${kw}」total=${s.total} pages=${s.totalPage}`);
        }
        stage.entryPoints.push(s.url);
        for (const b of s.list) if (!stage.cands[b.bookId]) stage.cands[b.bookId] = { ...b, source: s.url };
      } catch (e) {
        log(`[zh] 搜索「${kw}」p${p} 失败 ${e.message}`);
      }
      await sleep(GAP);
    }
  }
  writeJson(STAGE, stage);
}
log(`[zh] 候选合计 ${Object.keys(stage.cands).length} 本`);

const picked = [];
const nearMiss = [];
for (const b of Object.values(stage.cands)) {
  const title = clean(b.name);
  const desc = clean(b.description);
  const tags = String(b.keyword ?? "").split(/[,，]/).filter(Boolean);
  const evidence = { title: simHit(title), abstract: simHit(desc), tag: simHit(tags.join(" ")) };
  if (!evidence.title.length && !evidence.abstract.length && !evidence.tag.length) continue;
  const cat = `${b.catePName ?? ""} ${b.cateFineName ?? ""}`;
  if (CULT_CAT.test(cat) || CULT_TEXT.test(desc) || CULT_TEXT.test(title) || tags.some((t) => CULT_TEXT.test(t) || /仙侠|修真|玄幻/.test(t))) {
    picked.push({ ...b, title, desc, tags, evidence });
  } else {
    nearMiss.push({ title, url: `https://book.zongheng.com/book/${b.bookId}.html`, reason: `模拟但非修仙：分类「${cat.trim() || "未知"}」，简介与标签均无修真词` });
  }
}
log(`[zh] 满足 A+B ${picked.length} 本，nearMiss ${nearMiss.length} 本`);

picked.sort((a, b) => (b.totalWord ?? 0) - (a.totalWord ?? 0));
const todo = picked.slice(0, Number(process.env.CH5_ZH_LIMIT ?? 28));

let n = 0;
for (const b of todo) {
  n++;
  if (stage.books[b.bookId]?.page) continue;
  try {
    const page = await bookPage(b.bookId);
    fs.writeFileSync(path.join(RAW, `ch5_zh_${b.bookId}.html`), page.html, "utf8");
    delete page.html;
    await sleep(GAP);
    const first = await firstChapterDate(b.bookId);
    stage.books[b.bookId] = { page, first };
    writeJson(STAGE, stage);
    log(`[zh] (${n}/${todo.length}) ${b.title} 首章=${first.date ?? "?"} 点击=${page.clickTotal ?? "?"} 状态=${page.status ?? "?"}`);
  } catch (e) {
    log(`[zh] (${n}/${todo.length}) ${b.title} 失败 ${e.status ?? ""} ${e.message}`);
  }
  await sleep(GAP);
}

stage.picked = todo.map((b) => String(b.bookId));
stage.pickedMeta = todo;
stage.nearMiss = nearMiss;
writeJson(STAGE, stage);
log(`[zh] 完成，详情 ${Object.keys(stage.books).length} 本`);
