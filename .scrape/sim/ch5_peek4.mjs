// 通道 5 侦察第四轮：飞卢搜索结果页条目、纵横书页字段、17K sitemap 可用面。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const dir = path.join(import.meta.dirname, "raw");
const read = (n) => fs.readFileSync(path.join(dir, `ch5_${n}.html`), "utf8");

const fs1 = read("p3_faloo-search-t1");
const fs2 = read("p3_faloo-search-p2");
const ids = (h) => [...new Set([...h.matchAll(/b\.faloo\.com\/(\d{5,})\.html/g)].map((m) => m[1]))];
console.log("=== faloo 搜索 t=1 p1 书数 " + ids(fs1).length + " / p2 书数 " + ids(fs2).length);
console.log("  p1∩p2 重合 " + ids(fs1).filter((x) => ids(fs2).includes(x)).length);
console.log("=== faloo 搜索页命中书名");
for (const m of [...fs1.matchAll(/<h1 class="fontSize17andHei" title="([^"]+)"/g)].slice(0, 20)) console.log("  " + m[1]);
console.log("=== faloo 分页控件");
const pi = fs1.lastIndexOf("page");
console.log(strip(fs1.slice(pi - 1500, pi + 400)).slice(-700));

console.log("\n=== zongheng 书页字段");
const zb = read("p3_zh-book-real");
for (const key of ["book-meta", "status", "nums", "book-dec", "sidebar", "digg"]) {
  const i = zb.indexOf(key);
  if (i > 0) console.log(`--- ${key}\n` + strip(zb.slice(i - 300, i + 1200)).slice(0, 900) + "\n");
}

console.log("\n=== 17k sitemap");
console.log(read("p3_17k-sitemap").slice(0, 2000));
