// 通道 5 复核：飞卢简介块是不是被非贪婪正则提前截断、LXbq 标签里为什么混进「洪荒：」。
import fs from "node:fs";
import path from "node:path";

const RAW = path.join(import.meta.dirname, "raw");
const h = fs.readFileSync(path.join(RAW, "ch5_faloo_1398972.html"), "utf8");
const i = h.indexOf("T-L-T-C-Box1");
console.log("=== 简介块原文（含后续 400 字符，看有没有被内层 div 截断）");
console.log(h.slice(i - 40, i + 1200));
console.log("\n=== og:description");
console.log(/<meta[^>]+name="og:description"[^>]*content="([^"]*)"/.exec(h)?.[1]);
console.log("\n=== LXbq 标签链接原文");
for (const m of h.matchAll(/<a class="LXbq"[^>]*>[\s\S]{0,40}?<\/a>/g)) console.log("  " + m[0]);
