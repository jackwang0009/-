// 通道 3 探活第二轮：确认起点的 JS 挑战墙是否覆盖全部主机/入口，
// 以及 QQ阅读 除 robots 外是否还有别的 AI-bot 限制信号。只探不抓。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 仓库路径带中文，import.meta.url 是 percent-encoded 的，必须经 fileURLToPath 还原后再拼路径。
const DIR = fileURLToPath(new URL(".", import.meta.url));
const OUT = path.join(DIR, "raw");

const targets = [
  ["qd-home", "https://www.qidian.com/"],
  ["qd-m-home", "https://m.qidian.com/"],
  ["qd-m-robots", "https://m.qidian.com/robots.txt"],
  ["qd-book-page", "https://www.qidian.com/book/1035621989/"],
  ["qd-ajax-rank", "https://www.qidian.com/ajax/rank/getMoreRankList?rankId=yuepiao&pageNum=1"],
  ["qq-robots-again", "https://book.qq.com/robots.txt"],
  ["qq-category", "https://book.qq.com/category/-1-1-1-1-1-1-1/"],
];

for (const [name, url] of targets) {
  try {
    const html = await get(url, 1);
    fs.writeFileSync(path.join(OUT, `ch3_probe2_${name}.html`), html, "utf8");
    const challenged = html.includes("probe.js") || html.includes("var buid");
    console.log(
      `[ok]   ${name} len=${html.length} ${challenged ? "<< JS-CHALLENGE WALL" : ""}`,
    );
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    if (title) console.log(`       title: ${title}`);
  } catch (e) {
    console.log(`[fail] ${name} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}
