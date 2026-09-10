// 塔读列表页 + 书页字段探查，只取各一页，确认 DOM 后再写正式采集。
import { get } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const OUT = path.join(DIR, "raw");

const listUrl = "https://www.tadu.com/store/99-a-0-15-a-20-p-1-909";
const list = await get(listUrl, 2);
fs.writeFileSync(path.join(OUT, "ch3_alt_td-list99.html"), list, "utf8");
console.log("list len", list.length);
console.log("末页页码:", [...list.matchAll(/-p-(\d+)-909/g)].map((m) => +m[1]).sort((a, b) => b - a)[0]);

// 列表项：找 /book/数字/ 链接及其周边文本
const items = [...list.matchAll(/href="\/book\/(\d+)\/"[^>]*>([\s\S]{0,120}?)<\/a>/g)];
console.log("book links on page:", items.length);
for (const it of items.slice(0, 4))
  console.log("  id=" + it[1], "|", it[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 40));

await sleep(1500);

const bookId = items[0]?.[1];
if (bookId) {
  const bu = `https://www.tadu.com/book/${bookId}/`;
  const bp = await get(bu, 2);
  fs.writeFileSync(path.join(OUT, `ch3_alt_td-book-${bookId}.html`), bp, "utf8");
  console.log("\nbook page", bu, "len", bp.length);
  const grab = (re) => bp.match(re)?.[1]?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  console.log("  title:", grab(/<title>([\s\S]*?)<\/title>/i));
  console.log("  h1   :", grab(/<h1[^>]*>([\s\S]*?)<\/h1>/i));
  for (const kw of ["万字", "字数", "连载", "完结", "更新", "人气", "收藏", "点击", "推荐"]) {
    const i = bp.indexOf(kw);
    if (i > 0) console.log(`  [${kw}] ...${bp.slice(Math.max(0, i - 90), i + 30).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`);
  }
}
