// 通道 5 侦察：纵横书页简介块选择器、飞卢好评指数写法。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const zhFile = fs.readdirSync(RAW).find((f) => /^ch5_zh_\d+\.html$/.test(f));
const h = fs.readFileSync(path.join(RAW, zhFile), "utf8");
console.log("=== " + zhFile);
for (const sel of ["book-dec", "book_dec", "intro", "book-info-desc", "description"]) {
  const i = h.indexOf(sel);
  console.log(`  [${sel}] ` + (i > 0 ? "@" + i : "无"));
}
const i = h.indexOf('name="description"');
console.log("meta description: " + (/<meta[^>]+name="description"[^>]*content="([^"]*)"/.exec(h)?.[1] ?? "无").slice(0, 200));
const j = h.indexOf("book-dec");
if (j > 0) console.log("--- book-dec 原文\n" + h.slice(j - 200, j + 1200));

const faFile = fs.readdirSync(RAW).find((f) => /^ch5_faloo_\d+\.html$/.test(f));
const f = fs.readFileSync(path.join(RAW, faFile), "utf8");
const flat = strip(f).replace(/\s+/g, "");
console.log("\n=== " + faFile);
console.log("好评指数: " + (/好评指数[：:]([\d.]+)分/.exec(flat)?.[1] ?? "无"));
console.log("评价人数: " + (/评价人数[：:](\d+)人/.exec(flat)?.[1] ?? "无"));
