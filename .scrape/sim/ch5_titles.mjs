// 通道 5：飞卢式标题句式归纳。样本取本轮飞卢全部候选标题（含未入库的），
// 只入库的 46 本太少，看不出句式分布。
import path from "node:path";
import { readJson } from "../lib.mjs";
import { log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const faloo = readJson(path.join(RAW, "ch5_stage_faloo.json"));
const all = (faloo.harvested?.list ?? []).map((b) => b.title);
const sim = all.filter((t) => /模拟|推演|演算|沙盘|预演|重开/.test(t));
log(`飞卢候选标题 ${all.length} 条，其中模拟类 ${sim.length} 条`);

const PATTERNS = [
  ["世界前缀（冒号／逗号切出的题材帽子）", /^[^：:，,]{2,6}[：:]/],
  ["开局 X", /开局/],
  ["我有／我能 + 装置", /我(有|能)/],
  ["被某人「模拟／推演」曝光", /被[^，,。]{0,8}(模拟|推演)[^，,。]{0,6}(曝光|直播)/],
  ["曝光／直播（泛）", /曝光|直播/],
  ["从 X 开始", /从[^，,。]{1,10}开始/],
  ["模拟 N 次／亿万次", /(模拟|推演|演算)[^，,。]{0,4}(亿万|万|亿|百万|千|无限|N)?次/],
  ["让你 X，你却 Y（反差指令句）", /^让你|你(却|竟|怎么|成了)/],
  ["说好 X，怎么 Y（落差句）", /^说好/],
  ["逗号后接结果句（前因后果两段式）", /[，,]/],
  ["无敌／登顶／成神类结果词", /无敌|成神|登顶|证道|大帝|仙帝|道祖|最强/],
  ["杂役／废物／赘婿类低起点词", /杂役|废物|赘婿|太监|喽啰|凡人|F级|小兵/],
  ["悟性逆天", /悟性逆天/],
];

log("\n句式\t\t\t\t命中/占比");
for (const [name, re] of PATTERNS) {
  const hit = sim.filter((t) => re.test(t));
  const pct = ((hit.length / sim.length) * 100).toFixed(0);
  log(`${name}\t${hit.length} / ${pct}%`);
  for (const t of hit.slice(0, 3)) log(`      例：${t}`);
}

// 冒号前缀的具体题材帽子分布
log("\n=== 冒号前缀词频（题材帽子）");
const caps = new Map();
for (const t of sim) {
  const m = /^([^：:]{2,6})[：:]/.exec(t);
  if (m) caps.set(m[1], (caps.get(m[1]) ?? 0) + 1);
}
for (const [k, v] of [...caps].sort((a, b) => b[1] - a[1]).slice(0, 15)) log(`  ${k} ×${v}`);

log("\n=== 标题长度");
const lens = sim.map((t) => t.length).sort((a, b) => a - b);
log(`  中位 ${lens[Math.floor(lens.length / 2)]} 字，最短 ${lens[0]}，最长 ${lens.at(-1)}`);
