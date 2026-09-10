// 通道 3 · 第二格 Stage 1：塔读分类列表页扫描，建候选池。
// 塔读 robots 明禁 /search*，故不走站内搜索，改扫 /store/ 分类页（robots 对 * 为 Allow: /）。
// 列表页每条 <li> 已含 书名/简介摘要/作者/分类/字数/状态，先在此判条件 A，命中者 Stage 2 再取书页全文。
import { get, sleep, writeJson } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));

// SCHEMA 条件 A 关键词。「重开」「无限重生」限定为同一段时间反复重来义，Stage 2 人工复核。
export const KW_SIM = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "人生模拟", "无限重生", "重开"];
// SCHEMA 条件 B 简介关键词
export const KW_XIU = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道"];
// 条件 B 分类白名单（塔读分类名）
export const CAT_XIU = ["东方玄幻", "武侠仙侠"];

const CATS = [
  [99, "东方玄幻"],
  [109, "武侠仙侠"],
  [135, "脑洞创意"],
  [103, "现代都市"], // 只为产出 nearMiss（都市模拟），不进 books
];

const listUrl = (cat, page) => `https://www.tadu.com/store/${cat}-a-0-15-a-20-p-${page}-909`;

const unescape = (s) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function parseList(html, catName) {
  const out = [];
  for (const li of html.split("<li>").slice(1)) {
    const id = li.match(/href="\/book\/(\d+)\/"/)?.[1];
    if (!id) continue;
    const title = unescape(li.match(/class="bookNm"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim();
    const intro = unescape(li.match(/class="bookIntro"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim();
    const author = unescape(li.match(/class="authorNm"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim();
    const cat = unescape(li.match(/class="classifyLt"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "").trim();
    const wcRaw = li.match(/<span>\s*([\d.]+)\s*万字\s*<\/span>/)?.[1];
    const status = /class="condition"[\s\S]*?>(连载|完结)</.exec(li)?.[1] ?? "unknown";
    if (!title) continue;
    out.push({
      id,
      title,
      intro,
      author,
      cat: cat || catName,
      wordCount: wcRaw ? Math.round(parseFloat(wcRaw) * 10000) : null,
      status,
    });
  }
  return out;
}

const all = new Map();
let reqs = 0;

for (const [cat, catName] of CATS) {
  let pages = 1;
  for (let p = 1; p <= pages; p++) {
    let html;
    try {
      html = await get(listUrl(cat, p), 2);
      reqs++;
    } catch (e) {
      console.log(`[fail] cat=${catName} p=${p} -> ${e.status ?? e.message}`);
      break;
    }
    if (p === 1) {
      const nums = [...html.matchAll(new RegExp(`-p-(\\d+)-909`, "g"))].map((m) => +m[1]);
      pages = Math.max(1, ...nums);
      console.log(`\n=== ${catName} (cat=${cat}) 共 ${pages} 页 ===`);
    }
    const items = parseList(html, catName);
    for (const it of items) if (!all.has(it.id)) all.set(it.id, it);
    process.stdout.write(`  p${p}/${pages} +${items.length} (池 ${all.size})\r`);
    await sleep(1100);
  }
  console.log("");
}

const books = [...all.values()];
for (const b of books) {
  const hay = `${b.title}\n${b.intro}`;
  b.kwHit = KW_SIM.filter((k) => hay.includes(k));
  // 「模拟器」命中时「模拟」必然也命中，去掉冗余
  if (b.kwHit.includes("模拟器")) b.kwHit = b.kwHit.filter((k) => k !== "模拟");
  b.matchedIn = [];
  if (b.kwHit.some((k) => b.title.includes(k))) b.matchedIn.push("title");
  if (b.kwHit.some((k) => b.intro.includes(k))) b.matchedIn.push("abstract");
  b.condA = b.kwHit.length > 0;
  b.condB = CAT_XIU.includes(b.cat) || KW_XIU.some((k) => b.intro.includes(k));
}

const hitsA = books.filter((b) => b.condA);
writeJson(path.join(DIR, "ch3_alt_candidates.json"), {
  scannedAt: new Date().toISOString(),
  requests: reqs,
  cats: CATS.map(([, n]) => n),
  poolSize: books.length,
  books,
});

console.log(`\n--- Stage 1 汇总 ---`);
console.log(`请求 ${reqs} 次，候选池 ${books.length} 本`);
console.log(`条件 A 命中 ${hitsA.length} 本，其中 A+B 同时满足 ${hitsA.filter((b) => b.condB).length} 本`);
const byCat = {};
for (const b of hitsA) byCat[b.cat] = (byCat[b.cat] ?? 0) + 1;
console.log("A 命中按分类:", JSON.stringify(byCat, null, 0));
console.log("\nA+B 命中书名:");
for (const b of hitsA.filter((x) => x.condB)) console.log(`  [${b.cat}] ${b.title} — ${b.author} (${b.kwHit.join("/")})`);
