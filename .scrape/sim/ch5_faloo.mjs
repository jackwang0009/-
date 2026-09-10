// 通道 5 采集：飞卢小说网。
// 入口：站内搜索 b.faloo.com/l_0_{页}.html?t=1&k={GBK 编码关键词}（t=1 搜书名）+ 玄幻/仙侠分类页。
// 页面是 GB2312，走 ch5_lib 的编码嗅探；退避与 ≥1s 间隔沿用 lib.mjs 的纪律。
// 状态：书页不给（og:novel:status 恒为空），改用「已经完本」筛选列表求交集判定。
import fs from "node:fs";
import path from "node:path";
import { sleep, writeJson, readJson } from "../lib.mjs";
import { getHtml, strip, toWords, toNum, toDate, gbkEncodeURI, simHit, parseFalooDetail, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const STAGE = path.join(RAW, "ch5_stage_faloo.json");
const GAP = 1200;

const CULT_CAT = /玄幻|仙侠|修真|洪荒|神话|异世|奇幻|上古/;
const CULT_TEXT = /修仙|修真|炼气|筑基|金丹|元婴|宗门|灵根|大道/;

function parseList(html) {
  const out = [];
  for (const chunk of html.split('<div class="TwoBox02_02">').slice(1)) {
    const id = /b\.faloo\.com\/(\d{4,})\.html/.exec(chunk)?.[1];
    const title = /<h1 class="fontSize17andHei" title="([^"]+)"/.exec(chunk)?.[1];
    if (!id || !title) continue;
    const author = /l_0_1\.html\?t=2&k=[^"]*"\s*title="([^"]+)"/.exec(chunk)?.[1] ?? null;
    const cat = /l_\d+_\d+_1\.html"\s*title="([^"]+)"/.exec(chunk)?.[1] ?? null;
    const clickRaw = /([总周日])点击：([^<]+)</.exec(chunk);
    out.push({
      id,
      title: strip(title),
      author: author ? strip(author) : null,
      listCategory: cat ? strip(cat) : null,
      listClickMetric: clickRaw ? clickRaw[1] + "点击" : null,
      listClick: clickRaw ? toNum(clickRaw[2]) : null,
      listWordCount: toWords(/字数：([^<]+)</.exec(chunk)?.[1]),
      listDate: toDate(/日期：(?:<font[^>]*>)*\s*([^<]+)/.exec(chunk)?.[1]),
      listIntro: strip(/<div class="TwoBox02_06">([\s\S]*?)<\/div>/.exec(chunk)?.[1] ?? ""),
    });
  }
  return out;
}

const pageCount = (html) => Number(/共\s*(\d+)\s*页/.exec(strip(html))?.[1] ?? 1);

async function harvest() {
  const seen = new Map();
  const entryPoints = [];
  const pages = [];
  for (const [kw, n] of [["模拟", 10], ["模拟器", 3], ["推演", 3], ["演算", 2], ["沙盘", 2], ["预演", 2], ["人生模拟", 2], ["重开", 2]]) {
    for (let p = 1; p <= n; p++) pages.push([`搜索:${kw} p${p}`, `https://b.faloo.com/l_0_${p}.html?t=1&k=${gbkEncodeURI(kw)}`]);
  }
  for (const [cat, name] of [[1, "玄幻奇幻"], [6, "武侠仙侠"]]) {
    for (let p = 1; p <= 3; p++) pages.push([`分类:${name} p${p}`, `https://b.faloo.com/y_${cat}_0_0_0_0_0_${p}.html`]);
  }

  for (const [tag, url] of pages) {
    try {
      const r = await getHtml(url, 3);
      const items = parseList(r.html);
      if (!items.length) log(`[faloo] ${tag} 0 条 — 页面长度 ${r.html.length}，疑似被拦，人工复核`);
      let added = 0;
      for (const it of items) if (!seen.has(it.id)) (seen.set(it.id, { ...it, source: url }), added++);
      entryPoints.push(url);
      log(`[faloo] ${tag} 条目=${items.length} 新增=${added} 累计=${seen.size}`);
    } catch (e) {
      log(`[faloo] ${tag} 失败 ${e.status ?? ""} ${e.message}`);
    }
    await sleep(GAP);
  }
  return { list: [...seen.values()], entryPoints };
}

// 完本集合：玄幻奇幻(1) / 武侠仙侠(6) 的「已经完本」筛选列表（状态位=2），全量翻完才敢当判据
async function finishedSet() {
  const set = new Set();
  const notes = [];
  for (const [cat, name] of [[1, "玄幻奇幻"], [6, "武侠仙侠"]]) {
    let total = 1;
    for (let p = 1; p <= Math.min(total, 30); p++) {
      const url = `https://b.faloo.com/y_${cat}_0_0_0_2_0_${p}.html`;
      try {
        const r = await getHtml(url, 3);
        if (p === 1) {
          total = pageCount(r.html);
          notes.push(`${name} 完本列表共 ${total} 页`);
          log(`[faloo] 完本列表 ${name} 共 ${total} 页`);
        }
        for (const it of parseList(r.html)) set.add(it.id);
      } catch (e) {
        log(`[faloo] 完本列表 ${name} p${p} 失败 ${e.message}`);
      }
      await sleep(GAP);
    }
  }
  log(`[faloo] 完本集合 ${set.size} 本`);
  return { set: [...set], notes };
}

async function detail(bookId) {
  const r = await getHtml(`https://b.faloo.com/${bookId}.html`, 3);
  const h = r.html;
  if (h.length < 5000) throw new Error("详情页疑似拦截页，长度 " + h.length);
  return { ...parseFalooDetail(h, bookId), html: h };
}

// —— 主流程 ——
const fresh = process.env.CH5_FRESH === "1";
let stage = fresh ? null : readJson(STAGE, null);
if (!stage?.harvested) stage = { harvested: await harvest(), details: {} };
stage.details ??= {};
log(`[faloo] 候选合计 ${stage.harvested.list.length} 本`);

if (!stage.finished) stage.finished = await finishedSet();
writeJson(STAGE, stage);
const done = new Set(stage.finished.set);

const picked = [];
const nearMiss = [];
for (const b of stage.harvested.list) {
  const evidence = { title: simHit(b.title), abstract: simHit(b.listIntro) };
  if (!evidence.title.length && !evidence.abstract.length) continue;
  const catHit = CULT_CAT.test(b.listCategory ?? "");
  const textHit = CULT_TEXT.test(b.listIntro ?? "") || CULT_TEXT.test(b.title);
  if (catHit || textHit) picked.push({ ...b, evidence });
  else nearMiss.push({ title: b.title, url: `https://b.faloo.com/${b.id}.html`, reason: `模拟但非修仙：分类「${b.listCategory ?? "未知"}」，书名与简介均无修真词` });
}
log(`[faloo] 满足 A+B ${picked.length} 本，nearMiss ${nearMiss.length} 本`);

// SCHEMA 第 5 节修订 3 已拆掉 40–80 本上限，改为「凡过判据的全收」。这里原先写死 slice(0, 46)，
// 把 158 本过判据的书切成了按点击排序的头部；而排序键 listClick 还混着总点击与周点击
// （候选池 517 本周点击 / 178 本总点击），那个「头部」连口径都不齐。
// 现在全收：排序只决定抓取先后，不再决定收不收。CH5_FALOO_LIMIT 仅供调试限流。
picked.sort((a, b) => (b.listClick ?? 0) - (a.listClick ?? 0));
const limit = Number(process.env.CH5_FALOO_LIMIT ?? 0);
const todo = limit > 0 ? picked.slice(0, limit) : picked;

let n = 0;
for (const b of todo) {
  n++;
  if (stage.details[b.id]?.firstPublishDate) continue;
  try {
    const d = await detail(b.id);
    fs.writeFileSync(path.join(RAW, `ch5_faloo_${b.id}.html`), d.html, "utf8");
    delete d.html;
    stage.details[b.id] = d;
    writeJson(STAGE, stage);
    log(`[faloo] (${n}/${todo.length}) ${b.title} 入站=${d.firstPublishDate ?? "?"} 字=${d.wordCount ?? "?"} 章=${d.chapterTotal ?? "?"} ${done.has(b.id) ? "完结" : "连载?"}`);
  } catch (e) {
    log(`[faloo] (${n}/${todo.length}) ${b.title} 详情失败 ${e.status ?? ""} ${e.message}`);
  }
  await sleep(GAP);
}

stage.picked = todo.map((b) => b.id);
stage.pickedMeta = todo;
stage.nearMiss = nearMiss;
writeJson(STAGE, stage);
log(`[faloo] 完成，详情 ${Object.keys(stage.details).length} 本`);
