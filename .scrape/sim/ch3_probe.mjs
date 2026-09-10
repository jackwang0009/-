// 通道 3 探活脚本：起点 + QQ阅读。只探不抓，确认 URL 结构与可读字段后再写正式采集。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 仓库路径带中文，import.meta.url 是 percent-encoded 的，必须经 fileURLToPath 还原后再拼路径。
const DIR = fileURLToPath(new URL(".", import.meta.url));
const OUT = path.join(DIR, "raw");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  ["qidian-robots", "https://www.qidian.com/robots.txt"],
  ["qqbook-robots", "https://book.qq.com/robots.txt"],
  ["qidian-search-模拟", "https://www.qidian.com/so/%E6%A8%A1%E6%8B%9F.html"],
  ["qidian-xianxia-list", "https://www.qidian.com/xuanhuan/"],
  ["qidian-all-filter", "https://www.qidian.com/all/chanId21/"],
  ["qqbook-home", "https://book.qq.com/"],
];

for (const [name, url] of targets) {
  try {
    const html = await get(url, 2);
    fs.writeFileSync(path.join(OUT, `ch3_probe_${name}.html`), html, "utf8");
    console.log(`[ok]   ${name} ${url} len=${html.length}`);
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    if (title) console.log(`       title: ${title}`);
  } catch (e) {
    console.log(`[fail] ${name} ${url} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}
