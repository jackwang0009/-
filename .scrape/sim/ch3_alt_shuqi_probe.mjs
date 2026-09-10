// 通道 3 · 书旗 shuqi.com 探活。派单要求 raw_ch3_alt.json 用 platform 区分 tadu/shuqi，
// 但盘上 ch3_alt_candidates/ch3_alt_pages 两份全是塔读，书旗一条数据都没有——先探入口。
// robots（ch3_robots_verdict.json）：对 * 开放，禁 /about/ /excellence /inviteauthor /label /comment。
// 站内搜索未被禁 ⇒ 关键词入口可用；/label 被禁 ⇒ 标签聚合这条路不走。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");
fs.mkdirSync(RAW, { recursive: true });

const kw = encodeURIComponent("模拟");
const URLS = [
  ["search-1", `https://www.shuqi.com/search?keyword=${kw}`],
  ["search-2", `https://www.shuqi.com/search?key=${kw}`],
  ["soso", `https://www.shuqi.com/soso/${kw}.html`],
  ["sitemap-idx", `https://www.shuqi.com/sitemap/book_sitemap_all_pc_1.xml`],
  ["home", `https://www.shuqi.com/`],
  ["cat-xuanhuan", `https://www.shuqi.com/category`],
];

for (const [name, url] of URLS) {
  let html, err = null;
  try {
    html = await get(url, 1);
  } catch (e) {
    err = String(e.status ?? e.message);
    html = "";
  }
  const file = path.join(RAW, `ch3_shuqi_${name}.html`);
  if (html) fs.writeFileSync(file, html, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
  // 书页链接长什么样：把所有指向书页的 href 形态抠出来
  const hrefs = [...html.matchAll(/href="([^"]*(?:book|reader|\/b\/)[^"]*)"/g)].map((m) => m[1]);
  const shapes = [...new Set(hrefs.map((h) => h.replace(/\d+/g, "{N}")))].slice(0, 8);
  console.log(`\n[${name}] ${url}`);
  console.log(`  ${err ? "ERR " + err : `${html.length} 字节`} | <title>${title}`);
  if (shapes.length) console.log(`  书页链接形态: ${shapes.join("  ")}`);
  const jsRendered = html.length > 1000 && !/href="\/book\//.test(html) && /__NUXT__|__INITIAL_STATE__|window\.\w+\s*=\s*\{/.test(html);
  if (jsRendered) console.log(`  ⚠ 疑似 JS 渲染（有内联 state，无服务端书页链接）`);
  const st = html.match(/window\.__(NUXT|INITIAL_STATE)__/)?.[0];
  if (st) console.log(`  内联 state: ${st}`);
  await sleep(1200);
}
console.log("\n落盘 .scrape/sim/raw/ch3_shuqi_*.html");
