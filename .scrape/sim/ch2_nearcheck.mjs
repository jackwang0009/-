// 诊断：nearMiss(A∧¬B)=0 到底是判定代码的 bug，还是抽样口径的必然结果。
// 纯离线，只读 ch2_info.json 与 ch2_ids.json，不发任何请求。
import { readJson } from "../lib.mjs";

// 抄自 ch2_ids.mjs 的 CULT_CATEGORIES。不 import：那个文件是顶层脚本，
// 一 import 就会把步骤A 的抓取循环也跑起来。
const CULT_CATEGORIES = [
  [1140, "东方仙侠"], [258, "传统玄幻"], [257, "玄幻脑洞"], [124, "都市修真"],
  [511, "东方玄幻"], [259, "奇幻仙侠"], [66, "洪荒"], [7, "玄幻"],
];
const CULT_CAT = /仙侠|修真|修仙|玄幻|洪荒|宗门|东方玄幻/;

const info = readJson(".scrape/sim/ch2_info.json", {});
const all = Object.values(info);
const errs = all.filter((r) => r._err);
const recs = all.filter((r) => !r._err);

console.log(`ch2_info.json 共 ${all.length} 条：可用 ${recs.length}，错误 ${errs.length}`);

// ① _near 分支到底有没有落盘？（若字段整个缺失，才是「没被写进去」）
const hasNearKey = recs.filter((r) => "_near" in r).length;
const hasJudge = recs.filter((r) => r._judge).length;
console.log(`带 _near 字段 ${hasNearKey}/${recs.length}；带 _judge 字段 ${hasJudge}/${recs.length}`);
console.log(`_hit=true ${recs.filter((r) => r._hit).length}，_near=true ${recs.filter((r) => r._near).length}`);

// ② 从落盘的 _judge 重算，看 condA / condB 的真实分布
const A = recs.filter((r) => r._judge?.condA);
const B = recs.filter((r) => r._judge?.condB);
const notB = recs.filter((r) => r._judge && !r._judge.condB);
console.log(`\ncondA(模拟属性) 命中 ${A.length}；condB(修仙属性) 命中 ${B.length}；condB 不命中 ${notB.length}`);
console.log(`→ A∧¬B = ${A.filter((r) => !r._judge.condB).length}`);

// ③ condB 是怎么成立的：靠分类，还是靠简介？
const byCat = recs.filter((r) => r._judge?.catCult).length;
const byAbsOnly = recs.filter((r) => r._judge && !r._judge.catCult && r._judge.absCult?.length).length;
console.log(`   其中 靠分类成立 ${byCat}；分类不成立、仅靠简介词成立 ${byAbsOnly}`);

// ④ 候选池的来源：步骤A 枚举的八个分类是不是全都自带修仙属性
console.log(`\n步骤A 枚举的分类（ch2_ids.mjs CULT_CATEGORIES）：`);
for (const [id, name] of CULT_CATEGORIES) {
  console.log(`   ${String(id).padStart(4)} ${name.padEnd(6)} CULT_CAT 正则命中=${CULT_CAT.test(name)}`);
}
const nonCultSeed = CULT_CATEGORIES.filter(([, n]) => !CULT_CAT.test(n));
console.log(`   → 八个入口里，分类名本身不满足条件B 的有 ${nonCultSeed.length} 个`);

// ⑤ 反过来：有没有哪本书的 categoryV2 完全不含修仙类分类（即入口分类没写进 categoryV2）
const catNamesOf = (r) => (r._judge?.cats ?? []).map(String);
const noCultCat = recs.filter((r) => !catNamesOf(r).some((c) => CULT_CAT.test(c)));
console.log(`\ncategoryV2 里完全不含修仙类分类的书：${noCultCat.length} 本`);
noCultCat.slice(0, 15).forEach((r) =>
  console.log(`   ${r.bookName} | cats=${catNamesOf(r).join("/") || "(无)"} | condA=${r._judge?.condA} condB=${r._judge?.condB} absCult=${(r._judge?.absCult ?? []).join(",") || "-"}`)
);

// ⑥ 结论判据
console.log(`\n--- 判据 ---`);
if (hasNearKey < recs.length || hasJudge < recs.length) {
  console.log(`❌ _near/_judge 字段缺失，是落盘 bug`);
} else if (notB.length === 0) {
  console.log(`✅ _near 分支正常落盘，且全池 condB 恒为真 → A∧¬B 在数学上不可能出现`);
  console.log(`   原因不在判定代码，在候选池：步骤A 只枚举仙侠/玄幻系分类，B 在打 A 之前就已经过滤过一遍。`);
} else {
  console.log(`⚠ 存在 ¬B 的书 ${notB.length} 本，但 A∧¬B=0，需逐条看这些书为什么 condA 也不成立`);
}
