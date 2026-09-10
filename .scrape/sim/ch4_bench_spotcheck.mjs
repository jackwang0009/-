// 接手通道 4 · A1 层新进来的书要逐本看原文再用。
// 起因：改成按书去重并接进飞卢/塔读后，A1 多出两本飞卢的书，其中《前世模拟：我神话人仙身份
// 曝光了》603 万字，直接推翻草稿里「核心层没人写到 242 万字」那句结论。
// 低位起点词里「扫地」最不可靠——「扫地僧」「扫地出门」都会命中而与宗门杂役无关，
// 和我在通道 3 报的「重开」是同一类词形陷阱。命中处上下文抠出来看。
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const stats = JSON.parse(fs.readFileSync(DIR + "_bench_stats.json", "utf8"));

const MENIAL = /杂役|药童|打杂|做苦力|扫地|柴房|外门/g;
for (const tier of ["A1", "A2"]) {
  console.log(`\n======== ${tier} ========`);
  for (const b of stats[tier]) {
    const hay = [b.title, b.abstract, ...(b.tags || []), ...(b.categories || [])].join(" ");
    console.log(`\n--- ${b.title} — ${b.author}｜${(b.wordCount / 10000).toFixed(1)}万｜ch${b.chapterTotal ?? "—"}｜${b.status}｜${b.platforms.join("+")}`);
    console.log(`  起点词 ${b.menial.join("/")}｜模拟词 ${b.sim.join("/")}${b.longevity.length ? "+长生" : ""}`);
    for (const m of hay.matchAll(MENIAL)) {
      const i = m.index;
      console.log(`  「${m[0]}」→ …${hay.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ")}…`);
    }
  }
}
