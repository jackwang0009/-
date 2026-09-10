// 通道 3 · 第二格 Stage 2：塔读书页全量取字段。
// 为什么不沿用列表页预筛：列表页的 bookIntro 是截断摘要，且完全不含标签，而 SCHEMA 条件 A
// 允许 matchedIn=tag。书页的 div.sortList 才有标签，p.intro 才是简介全文。故对三个与条件 B
// 相关的分类逐本取页，不抽样、不预筛。
//
// 坑（已踩）：书页右侧「本书作者」框里的「累计字数 795.90万字」是**作者名下所有作品**的合计，
// 不是本书字数。本书字数在 div.datum 的第一个 <em>（192.51万 字）。取错会差一个量级。
import { get, sleep, readJson, writeJson } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const CACHE = path.join(DIR, "ch3_alt_pages.json");
const REL_CATS = ["东方玄幻", "武侠仙侠", "脑洞创意"];

const pool = readJson(path.join(DIR, "ch3_alt_candidates.json")).books;
const targets = pool.filter((b) => REL_CATS.includes(b.cat));
const done = readJson(CACHE, {});
console.log(`目标 ${targets.length} 本（${REL_CATS.join("/")}），已缓存 ${Object.keys(done).length} 本`);

const strip = (s) =>
  String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

// 「23.9万」→ 239000；「1234」→ 1234
const cnNum = (s) => {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*(万|亿)?/);
  if (!m) return null;
  const mult = m[2] === "亿" ? 1e8 : m[2] === "万" ? 1e4 : 1;
  return Math.round(parseFloat(m[1]) * mult);
};

const TODAY = "2026-09-08";
const relDate = (s) => {
  if (!s) return null;
  const abs = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (abs) return abs[0];
  if (/小时前|分钟前|刚刚/.test(s)) return TODAY;
  const d = s.match(/(\d+)\s*天前/);
  if (d) {
    const t = new Date(`${TODAY}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - +d[1]);
    return t.toISOString().slice(0, 10);
  }
  return null;
};

function parseBook(html) {
  const datum = html.match(/<div class="datum">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const spans = [...datum.matchAll(/<span[^>]*>\s*<em[^>]*>([^<]*)<\/em>\s*(?:&nbsp;)*\s*([^<]*)<\/span>/g)];
  const stat = {};
  for (const [, val, label] of spans) stat[label.replace(/\s|&nbsp;/g, "")] = val.trim();

  return {
    abstract: strip(html.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/)?.[1]),
    tags: [...(html.match(/<div class="sortList">([\s\S]*?)<\/div>/)?.[1] ?? "").matchAll(/<a[^>]*>([^<]+)<\/a>/g)]
      .map((m) => strip(m[1]))
      .filter(Boolean),
    // 本书字数取 datum 块，绝不取「累计字数」
    wordCount: cnNum(stat["字"]),
    popularityRaw: cnNum(stat["周人气"]),
    votes: cnNum(stat["总银票"]),
    chapterTotal: Number(html.match(/目录[\s\S]{0,40}?（(\d+)章）/)?.[1]) || null,
    lastUpdateDate: relDate(
      strip(html.match(/class="newChapterBox[\s\S]*?<em>([^<]+)<\/em>/)?.[1]),
    ),
  };
}

let n = 0;
for (const b of targets) {
  if (done[b.id]) continue;
  try {
    const html = await get(`https://www.tadu.com/book/${b.id}/`, 2);
    done[b.id] = parseBook(html);
  } catch (e) {
    done[b.id] = { error: String(e.status ?? e.message) };
  }
  if (++n % 25 === 0) {
    writeJson(CACHE, done);
    process.stdout.write(`  ${n}/${targets.length - Object.keys(done).length + n} 已取 ${Object.keys(done).length}\n`);
  }
  await sleep(1150);
}
writeJson(CACHE, done);

const okCount = Object.values(done).filter((v) => !v.error).length;
console.log(`\n取回完成：${okCount} 成功 / ${Object.keys(done).length - okCount} 失败`);
const noAbs = Object.values(done).filter((v) => !v.error && !v.abstract).length;
const noWc = Object.values(done).filter((v) => !v.error && !v.wordCount).length;
console.log(`简介为空 ${noAbs} 本，字数为空 ${noWc} 本（这两个数若偏高说明选择器又漂了）`);
