// 通道 3 · 重取 396 本空字段书页，并补上 SCHEMA 第 4 节要求的「异常短就当失败」断言。
//
// 定性结论（ch3_alt_probe2/probe3 取证）：不是选择器漂了。老正则原样跑在今天重取的同一批
// 书页上，p.intro / datum / sortList / 目录章数 六项全部正常解出；这 396 本在列表页也都有字数。
// 所以 22:20 那轮拿到的响应本身就不是完整书页——HTTP 200、不抛异常、不空 body，解析器安静
// 地返回一堆 null，正是 SCHEMA「最贵的一类失败是不报错的那一类」说的那种。
// ch3_alt_fetch.mjs 缺的正是那条断言，故本轮补上：datum 块缺失或页面异常短 → 当失败重试。
import { get, sleep, readJson, writeJson } from "../lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const CACHE = path.join(DIR, "ch3_alt_pages.json");
const pages = readJson(CACHE);
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const byId = new Map(cand.books.map((b) => [b.id, b]));

const REL_CATS = ["东方玄幻", "武侠仙侠", "脑洞创意"];
const order = cand.books.filter((b) => REL_CATS.includes(b.cat)).map((b) => b.id); // 原抓取顺序
const bad = order.filter((id) => pages[id] && !pages[id].error && !pages[id].abstract);

// 空批在原抓取顺序里的位置：连续块 ⇒ 一段时间窗内站方返了别的东西；散布 ⇒ 另有成因
const pos = bad.map((id) => order.indexOf(id));
let runs = 1;
for (let i = 1; i < pos.length; i++) if (pos[i] !== pos[i - 1] + 1) runs++;
console.log(`空批 ${bad.length} 本，在原抓取顺序中的位置 ${pos[0]}–${pos[pos.length - 1]}，连续段数 ${runs}`);
console.log(`（连续段数接近 1 ⇒ 一段时间窗；接近 ${bad.length} ⇒ 逐本散布）`);

const strip = (s) =>
  String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

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
    wordCount: cnNum(stat["字"]),
    popularityRaw: cnNum(stat["周人气"]),
    votes: cnNum(stat["总银票"]),
    chapterTotal: Number(html.match(/目录[\s\S]{0,40}?（(\d+)章）/)?.[1]) || null,
    lastUpdateDate: relDate(strip(html.match(/class="newChapterBox[\s\S]*?<em>([^<]+)<\/em>/)?.[1])),
  };
}

// 这一条是本轮的重点：正常书页最小的也有 3 万字节，datum 块必然存在。
// 两者任一不满足 ⇒ 拿到的不是书页，当失败退避重试，绝不交给解析器。
const MIN_BYTES = 20000;
const looksLikeBookPage = (html) => html.length >= MIN_BYTES && /<div class="datum">/.test(html);

let fixed = 0;
let stillBad = 0;
let n = 0;
const stillBadIds = [];
for (const id of bad) {
  let got = null;
  for (let attempt = 0; attempt < 3 && !got; attempt++) {
    try {
      const html = await get(`https://www.tadu.com/book/${id}/`, 1);
      if (!looksLikeBookPage(html)) {
        console.log(`  [短页] ${id} ${html.length} 字节，无 datum 块 → 退避重试 ${attempt + 1}/3`);
        await sleep(5000);
        continue;
      }
      got = parseBook(html);
    } catch (e) {
      await sleep(2000);
    }
  }
  if (got && got.abstract) {
    pages[id] = got;
    fixed++;
  } else if (got) {
    // 页面确实是书页，但简介真为空（站方就没填）——这才是「站上没有」
    pages[id] = { ...got, abstractEmptyOnSite: true };
    fixed++;
  } else {
    stillBad++;
    stillBadIds.push(id);
  }
  if (++n % 25 === 0) {
    writeJson(CACHE, pages);
    process.stdout.write(`  ${n}/${bad.length} 修复 ${fixed}，仍失败 ${stillBad}\n`);
  }
  await sleep(1150);
}
writeJson(CACHE, pages);
console.log(`\n重取完成：修复 ${fixed} / 仍失败 ${stillBad}`);
if (stillBadIds.length) console.log(`仍失败 id: ${stillBadIds.join(",")}`);
const left = Object.entries(pages).filter(([, v]) => !v.error && !v.abstract).length;
console.log(`全库剩余空简介 ${left} 本`);
