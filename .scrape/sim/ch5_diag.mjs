// 通道 5 诊断：详情页字段为什么全空、后半程列表页为什么 0 条。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const files = fs.readdirSync(RAW).filter((f) => /^ch5_faloo_\d+\.html$/.test(f));
console.log("详情页存档数 " + files.length);
const f0 = files[0];
const h = fs.readFileSync(path.join(RAW, f0), "utf8");
console.log(`=== ${f0} len=${h.length}`);
console.log("title: " + strip(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "(无)"));
console.log("有 og:novel:click_cnt? " + /og:novel:click_cnt/.test(h));
console.log("有 入站时间? " + h.includes("入站时间"));
console.log("有 T-L-T-C-Box1? " + h.includes("T-L-T-C-Box1"));
const flat = strip(h).replace(/\n+/g, " ");
console.log("flat 长度 " + flat.length);
console.log("flat 片段: " + flat.slice(0, 400));
const i = h.indexOf("入站时间");
if (i > 0) console.log("入站时间原文: " + h.slice(i - 300, i + 300));

console.log("\n=== 各详情页大小分布");
const sizes = files.map((f) => [f, fs.statSync(path.join(RAW, f)).size]);
sizes.sort((a, b) => a[1] - b[1]);
console.log("  最小 " + sizes[0].join(" ") + "  最大 " + sizes.at(-1).join(" "));
console.log("  小于 50KB 的: " + sizes.filter((s) => s[1] < 50000).length);
