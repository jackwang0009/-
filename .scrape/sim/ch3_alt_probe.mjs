// 通道 3 · 第二格探活：书旗 + 塔读的入口结构。
// robots 已判定两家 OPEN；书旗禁 /label /comment /about/ /excellence /inviteauthor，塔读禁 /search*。
// 本脚本只探入口可用性与字段位置，不落书目。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const OUT = path.join(DIR, "raw");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  // 书旗：搜索未被 robots 禁，优先探搜索；分类页与 sitemap 作为备份入口
  ["sq-home", "https://www.shuqi.com/"],
  ["sq-search", "https://www.shuqi.com/search?keyword=%E6%A8%A1%E6%8B%9F"],
  ["sq-soso", "https://www.shuqi.com/soso/%E6%A8%A1%E6%8B%9F"],
  ["sq-cat-xuanhuan", "https://www.shuqi.com/category/xuanhuan"],
  ["sq-sitemap1", "https://www.shuqi.com/sitemap/book_sitemap_all_pc_1.xml"],
  // 塔读：/search 明禁，只走首页/分类/榜单/sitemap
  ["td-home", "https://www.tadu.com/"],
  ["td-sitemap", "https://www.tadu.com/sitemap.xml"],
  ["td-store", "https://www.tadu.com/store/"],
  ["td-book-cat", "https://www.tadu.com/book/catalogue/"],
];

for (const [name, url] of targets) {
  try {
    const body = await get(url, 1);
    fs.writeFileSync(path.join(OUT, `ch3_alt_${name}.html`), body, "utf8");
    const challenged = body.includes("probe.js") || body.includes("var buid");
    const title = body.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    console.log(`[ok]   ${name} len=${body.length} ${challenged ? "<< JS-CHALLENGE" : ""}`);
    if (title) console.log(`       title: ${title}`);
    // 粗看这一页里有没有书链接，判断它当不当得起列表入口
    const bookLinks = [...body.matchAll(/href="([^"]*\/(?:book|bookinfo|b)\/[^"]*)"/gi)]
      .map((m) => m[1]);
    if (bookLinks.length)
      console.log(`       book-ish links: ${bookLinks.length}, e.g. ${bookLinks[0]}`);
    if (body.includes("<urlset") || body.includes("<sitemapindex"))
      console.log(`       XML sitemap, <loc> count = ${(body.match(/<loc>/g) || []).length}`);
  } catch (e) {
    console.log(`[fail] ${name} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}
