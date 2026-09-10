// 通道 5 结构侦察第二轮：纵横书库页条目、飞卢列表条目字段、飞卢搜索入口、17K 首页链接形态。
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "raw");
const read = (n) => fs.readFileSync(path.join(dir, `ch5_${n}.html`), "utf8");

console.log("=== faloo robots (www)\n" + read("p2_faloo-robots-plain"));

const zh = read("p2_zh-store-old");
console.log("=== zongheng 书库条目：书链接");
const zhIds = [...new Set([...zh.matchAll(/book\.zongheng\.com\/book\/(\d+)\.html/g)].map((m) => m[1]))];
console.log("  count=" + zhIds.length + "  " + zhIds.slice(0, 12).join(","));
const i0 = zh.indexOf("bookbox");
console.log("=== zongheng 单条原样\n" + zh.slice(i0 - 200, i0 + 2200));

const fa = read("p2_faloo-xianxia");
const j0 = fa.indexOf("TwoBox02_01");
console.log("=== faloo 单条原样\n" + fa.slice(j0 - 100, j0 + 2600));

console.log("=== faloo 搜索相关字样");
for (const m of [...fa.matchAll(/[^\s"'<>]{0,40}(?:search|Search|so\.faloo)[^\s"'<>]{0,60}/g)].slice(0, 20)) console.log("  " + m[0]);

const k = read("p2_17k-www");
console.log("=== 17k 首页链接形态");
const kinds = new Map();
for (const m of k.matchAll(/href="(https?:\/\/[^"]+17k\.com[^"]*)"/g)) {
  const u = new URL(m[1]);
  const key = u.host + "/" + u.pathname.split("/").slice(1, 2).join("/");
  kinds.set(key, (kinds.get(key) ?? 0) + 1);
}
for (const [kk, v] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${kk}  x${v}`);
