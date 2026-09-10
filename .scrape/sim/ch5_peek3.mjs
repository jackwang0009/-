// 通道 5 侦察第三轮：飞卢站内搜索 JS 入口、纵横书库分类码。
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "raw");
const read = (n) => fs.readFileSync(path.join(dir, `ch5_${n}.html`), "utf8");

const fa = read("p2_faloo-xianxia");
console.log("=== faloo SearchBook / 搜索表单上下文");
for (const m of [...fa.matchAll(/function\s+SearchBook[\s\S]{0,700}?\n\s*\}/g)]) console.log(m[0]);
const si = fa.indexOf("SearchCenterDiv1-Two");
console.log("--- 搜索框 DOM\n" + fa.slice(si - 600, si + 900));

console.log("\n=== zongheng 书库分类导航");
const zh = read("p2_zh-store-old");
for (const m of [...zh.matchAll(/href="([^"]*\/store\/c(\d+)\/[^"]*)"[^>]*>\s*([^<]{1,12})\s*</g)].slice(0, 40)) {
  console.log(`  c${m[2]}  ${m[3].trim()}`);
}
console.log("--- 排序/筛选参数说明位");
const zi = zh.indexOf("store_filter") > 0 ? zh.indexOf("store_filter") : zh.indexOf("filter");
console.log(zh.slice(zi - 200, zi + 1800).replace(/\n\s*\n/g, "\n"));
