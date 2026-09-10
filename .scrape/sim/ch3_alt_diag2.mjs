// 通道 3 · 两个收口前必须落实的问题：
//  Q1 p.intro 到底是不是简介全文？若是截断摘要，条件 A 会系统性漏判（SCHEMA 第 5 节点名的那类漏）。
//     判法：拿落盘的 9 份书页 HTML，把 p.intro 与 <meta name="description"> 及页面里最长的
//     intro 类块三者比长度。p.intro 最长或与 description 同源 ⇒ 是全文。
//  Q2 现代都市那 404 本没取书页，只有列表页截断摘要。用它判条件 A 能召回几本？其中有几本
//     同时带修仙词（那种要补取书页才能进 books，否则字段不全）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "../lib.mjs";
import { KW_XIU, simHits } from "./ch3_alt_kw.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");

console.log("=== Q1 p.intro 是否全文 ===");
for (const f of fs.readdirSync(RAW).filter((x) => /^ch3_alt_probe_/.test(x))) {
  const html = fs.readFileSync(path.join(RAW, f), "utf8");
  const clean = (s) => String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const pIntro = clean(html.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
  const meta = clean(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]);
  const divIntro = clean(html.match(/<div[^>]*class="[^"]*bookIntro[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
  const trunc = /(\.\.\.|…)\s*$/.test(pIntro);
  console.log(
    `  ${f.replace(/ch3_alt_probe_|\.html/g, "")}: p.intro ${pIntro.length} 字${trunc ? " ⚠以省略号结尾" : ""} / meta.description ${meta.length} 字 / div.bookIntro ${divIntro.length} 字` +
      `${meta && pIntro && meta.length > pIntro.length + 5 ? "  ⚠ description 更长" : ""}`,
  );
}

console.log("\n=== Q2 现代都市（未取书页）用列表摘要的召回 ===");
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));
const city = cand.books.filter((b) => b.cat === "现代都市");
const hitA = city.filter((b) => simHits(`${b.title}\n${b.intro}`).length);
const hitAB = hitA.filter((b) => KW_XIU.some((k) => b.intro.includes(k)));
console.log(`  现代都市 ${city.length} 本，条件 A 命中 ${hitA.length} 本（→ nearMiss），其中带修仙词 ${hitAB.length} 本（→ 需补取书页才能进 books）`);
for (const b of hitAB) console.log(`    [需补取] ${b.id} ${b.title} — ${b.author}｜${b.intro.slice(0, 60)}…`);
for (const b of hitA.filter((x) => !hitAB.includes(x)).slice(0, 12)) {
  console.log(`    [nearMiss] ${b.title} — ${simHits(`${b.title}\n${b.intro}`).join("/")}`);
}

console.log("\n=== 三个相关分类里，条件 A 命中的全部（书页全文口径） ===");
const REL = ["东方玄幻", "武侠仙侠", "脑洞创意"];
let n = 0;
for (const b of cand.books.filter((x) => REL.includes(x.cat))) {
  const p = pages[b.id];
  if (!p || p.error) continue;
  const hits = simHits(`${b.title}\n${p.abstract ?? ""}\n${(p.tags ?? []).join(" ")}`);
  if (!hits.length) continue;
  n++;
  const where = [];
  if (simHits(b.title).length) where.push("title");
  if (simHits((p.tags ?? []).join(" ")).length) where.push("tag");
  if (simHits(p.abstract ?? "").length) where.push("abstract");
  console.log(`  ${b.id} [${b.cat}] ${b.title} — ${b.author}｜命中 ${hits.join("/")} @ ${where.join("+")}｜简介 ${(p.abstract ?? "").length} 字`);
}
console.log(`  小计 ${n} 本`);
