// 通道 5 侦察第六轮：飞卢书页字段位置、17K sitemap 子表内容、纵横搜索 JSON 结构。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const dir = path.join(import.meta.dirname, "raw");
const read = (n) => fs.readFileSync(path.join(dir, `ch5_${n}.html`), "utf8");

const fb = read("p4_faloo-book");
console.log("=== faloo 书页 <head> 元信息");
for (const m of [...fb.matchAll(/<meta[^>]+(?:property|name)="([^"]+)"[^>]*content="([^"]*)"/g)].slice(0, 25)) {
  console.log(`  ${m[1]} = ${m[2].slice(0, 140)}`);
}
console.log("=== faloo 书页信息区");
for (const key of ["colorHui", "T-R-G-Box", "noveHead", "detail"]) {
  const i = fb.indexOf(key);
  if (i > 0) {
    console.log(`--- ${key} @${i}`);
    console.log(strip(fb.slice(i - 500, i + 2500)).slice(0, 1400));
    break;
  }
}
console.log("=== faloo 日期/字数/点击 原文附近");
for (const kw of ["首发", "字数", "总点击", "更新时间", "上架"]) {
  const i = fb.indexOf(kw);
  console.log(`  [${kw}] ` + (i > 0 ? strip(fb.slice(i - 160, i + 160)).replace(/\n/g, " ") : "(未出现)"));
}

console.log("\n=== 17k sitemap 子表");
const sm = read("p4_17k-sitemap-sub");
console.log(sm.slice(0, 900));
console.log("  url 数 = " + (sm.match(/<loc>/g) ?? []).length);
