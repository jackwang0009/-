// 通道 5 侦察第五轮：纵横书页 og 元信息与标签块，作为字段抽取的准据。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const zb = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_p3_zh-book-real.html"), "utf8");
console.log("=== og / meta");
for (const m of zb.matchAll(/<meta[^>]+(?:property|name)="((?:og|book):[^"]+)"[^>]*content="([^"]*)"/g)) {
  console.log(`  ${m[1]} = ${m[2].slice(0, 120)}`);
}
console.log("=== 简介块");
for (const key of ['class="book-dec', "book-dec", "introTxt", "book-info"]) {
  const i = zb.indexOf(key);
  if (i > 0) {
    console.log(`--- ${key} @${i}`);
    console.log(strip(zb.slice(i - 100, i + 1500)).slice(0, 800));
    break;
  }
}
console.log("=== 标签块");
const t = zb.indexOf("keyword");
console.log(zb.slice(t - 400, t + 900));
