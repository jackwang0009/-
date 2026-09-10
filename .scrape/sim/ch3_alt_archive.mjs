// 通道 3 · 给交付里的每本书存一份原始 HTML，让 ch3_validate.mjs 的 abstract 回源比对
// 能真正跑起来（SCHEMA 修订 4：自检要回源取证，不要用字符串启发式）。
// 交付只有个位数本书，逐本存档的代价可以忽略。
import { get, sleep, readJson } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");
fs.mkdirSync(RAW, { recursive: true });

const data = readJson(path.join(DIR, "raw_ch3_alt.json"));
for (const b of data.books ?? []) {
  const file = path.join(RAW, `ch3_alt_book_${b.platformBookId}.html`);
  if (fs.existsSync(file)) {
    console.log(`  已有存档 ${b.title}`);
    continue;
  }
  const html = await get(b.url, 2);
  if (html.length < 20000 || !/<div class="datum">/.test(html)) {
    console.log(`  ✗ ${b.title} 取回 ${html.length} 字节且无 datum 块，不是书页，不存档`);
    continue;
  }
  fs.writeFileSync(file, html, "utf8");
  console.log(`  ✓ ${b.title} → raw/ch3_alt_book_${b.platformBookId}.html (${html.length} 字节)`);
  await sleep(1200);
}
