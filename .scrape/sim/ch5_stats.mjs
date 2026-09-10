// 通道 5 收口统计：分站本数与字数中位数（不跨站合成）、按首发日期排最早 5 本、飞卢式书名句式归纳。
// 只读 raw_ch5_feilu.json 与 raw/ 下的存档 HTML，只写 ch5_stats.txt。
import path from "node:path";
import fs from "node:fs";
import { readJson } from "../lib.mjs";

const DIR = import.meta.dirname;
const { books, meta } = readJson(path.join(DIR, "raw_ch5_feilu.json"));
const out = [];
const say = (...a) => out.push(a.join(" "));

const median = (xs) => {
  const s = xs.filter(Number.isInteger).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const wan = (n) => (n == null || !Number.isFinite(n) ? "—" : (n / 10000).toFixed(1) + " 万字");

// ── 交付 1：分站本数 + 各自字数中位数。两站口径不同，刻意不合成一个数。
say("【交付 1】三站实收本数与字数中位数（分站，不合成）");
say("| 站点 | 实收 | 字数中位数 | 最小 | 最大 | 状态分布 |");
say("| --- | --- | --- | --- | --- | --- |");
for (const p of meta.platforms) {
  const s = books.filter((b) => b.platform === p);
  const w = s.map((b) => b.wordCount).filter(Number.isInteger);
  const st = s.reduce((a, b) => ((a[b.status] = (a[b.status] ?? 0) + 1), a), {});
  const stTxt = Object.entries(st).map(([k, v]) => `${k}×${v}`).join(" ") || "—";
  say(`| ${p} | ${s.length} | ${wan(median(w))} | ${wan(Math.min(...w))} | ${wan(Math.max(...w))} | ${stTxt} |`);
}

// ── 交付 2：按 firstPublishDate 排最早 5 本。全组只有本通道这一格拿得到年代跨度。
say("");
say("【交付 2】按 firstPublishDate 排序最早 5 本");
const early = books.filter((b) => b.firstPublishDate).sort((a, b) => a.firstPublishDate.localeCompare(b.firstPublishDate));
for (const b of early.slice(0, 5)) {
  say(`  ${b.firstPublishDate}  [${b.platform}] 《${b.title}》/ ${b.author}`);
  say(`      ${wan(b.wordCount)} · ${b.status} · ${(b.categories ?? []).join("/")} · 判据命中 ${b.simEvidence.matchedIn.join("+")} → ${b.simEvidence.keywords.join("、")}`);
  say(`      末更 ${b.lastUpdateDate} · ${b.url}`);
}
say("");
say("  年代跨度：最早 " + early[0].firstPublishDate + " → 最新 " + early.at(-1).firstPublishDate);
const byYear = books.reduce((a, b) => ((a[b.firstPublishDate.slice(0, 4)] = (a[b.firstPublishDate.slice(0, 4)] ?? 0) + 1), a), {});
say("  首发年份分布：" + Object.entries(byYear).sort().map(([k, v]) => `${k}×${v}`).join("  "));
for (const p of ["faloo", "zongheng"]) {
  const s = books.filter((b) => b.platform === p).map((b) => b.firstPublishDate).sort();
  say(`  ${p} 单站跨度：${s[0]} → ${s.at(-1)}（中位首发 ${s[Math.floor(s.length / 2)]}）`);
}

// ── 交付 3：飞卢式书名句式。先给可判定的结构特征，再给人读的句式归纳。
say("");
say("【交付 3】飞卢式标题句式");
const fal = books.filter((b) => b.platform === "faloo");
const zh = books.filter((b) => b.platform === "zongheng");
const SIM = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "重开", "人生模拟"];
const feats = {
  "冒号分隔（前缀＋主句）": (t) => /[：:]/.test(t),
  "逗号分隔（并列小句）": (t) => /[，,]/.test(t),
  "「开局」起手": (t) => t.includes("开局"),
  "模拟词进书名": (t) => SIM.some((w) => t.includes(w)),
  "感叹号收尾": (t) => /[！!]$/.test(t),
  "反差挑衅（竟然/居然/你管这叫/谁能想到）": (t) => /竟然|居然|你管这叫|我怎么|谁能想到/.test(t),
  "第一人称「我」": (t) => /我/.test(t),
  "强度词（逆天/无敌/最强/至高/亿万次）": (t) => /逆天|无敌|最强|至高|万倍|亿万?次/.test(t),
};
say(`| 结构特征 | 飞卢 ${fal.length} 本 | 纵横 ${zh.length} 本 |`);
say("| --- | --- | --- |");
const pct = (n, d) => `${n}/${d}（${Math.round((n / d) * 100)}%）`;
for (const [name, fn] of Object.entries(feats)) {
  say(`| ${name} | ${pct(fal.filter((b) => fn(b.title)).length, fal.length)} | ${pct(zh.filter((b) => fn(b.title)).length, zh.length)} |`);
}
const len = (xs) => (xs.reduce((a, b) => a + b.title.length, 0) / xs.length).toFixed(1);
say(`| 书名平均字数 | ${len(fal)} 字 | ${len(zh)} 字 |`);

// 冒号前缀是飞卢标题的核心零件，单独把前缀词频拉出来。
// 模拟词内部有分工：推演偏功法/武学，模拟(器)偏人生/身份。分开数才看得出来。
say("");
say("  模拟词用词分工（书名内）：");
for (const [name, re] of [["推演/演算", /推演|演算/], ["模拟器/模拟系统", /模拟器|模拟系统/], ["模拟（作动词）", /模拟(?!器|系统)/], ["人生模拟/前世模拟/转生", /人生模拟|前世模拟|模拟转生/], ["沙盘/预演/重开", /沙盘|预演|重开/]]) {
  say(`    ${name}：飞卢 ${fal.filter((b) => re.test(b.title)).length} / 纵横 ${zh.filter((b) => re.test(b.title)).length}`);
}
say("");
say("  高频零件：");
for (const [name, re] of [["开局", /开局/], ["从…开始", /从.{1,8}开始/], ["悟性逆天", /悟性逆天/], ["曝光/被看见", /曝光|被.{0,4}(发现|看见|直播)/], ["多重人格", /多重人格/], ["量级词（亿次/亿万次/百万年/无数/万界）", /亿次|亿万次|百万年|无数|万界|万千/], ["全民/诸天/无限", /全民|诸天|无限/]]) {
  const ex = fal.filter((b) => re.test(b.title));
  say(`    ${name}：飞卢 ${ex.length} / 纵横 ${zh.filter((b) => re.test(b.title)).length}` + (ex.length ? `　例：${ex.slice(0, 3).map((b) => b.title).join("｜")}` : ""));
}

say("");
say("  冒号前缀词频（飞卢）：");
const pre = {};
for (const b of fal) {
  const m = /^([^：:]{1,6})[：:]/.exec(b.title);
  if (m) pre[m[1]] = (pre[m[1]] ?? 0) + 1;
}
say("    " + Object.entries(pre).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join("  "));

say("");
say("  飞卢全部 46 条书名（供归纳核对）：");
for (const b of [...fal].sort((a, b) => a.title.localeCompare(b.title, "zh"))) say("    " + b.title);
say("");
say("  纵横全部 28 条书名（对照）：");
for (const b of [...zh].sort((a, b) => a.title.localeCompare(b.title, "zh"))) say("    " + b.title);

// ── 附带诊断：ch5_validate 报的 46 条「abstract 疑似被截断」到底是不是真截断。
say("");
say("【诊断】abstract 结尾 … 的条目");
const dots = books.filter((b) => b.abstract?.endsWith("..."));
say(`  命中 ${dots.length} 条，分站：` + JSON.stringify(dots.reduce((a, b) => ((a[b.platform] = (a[b.platform] ?? 0) + 1), a), {})));
if (dots.length) say(`  长度：最短 ${Math.min(...dots.map((b) => b.abstract.length))} / 最长 ${Math.max(...dots.map((b) => b.abstract.length))}`);
// 逐条比对存档 HTML：站方原文就这么结尾（作者自己打的省略号），还是我们截了它。
for (const b of dots) {
  const p = path.join(DIR, "raw", `ch5_faloo_${b.platformBookId}.html`);
  const box = fs.existsSync(p)
    ? (/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(fs.readFileSync(p, "utf8"))?.[1] ?? "").replace(/<[^>]+>/g, "").trim()
    : null;
  say(`  《${b.title}》abstract ${b.abstract.length} 字，末 40 字：${JSON.stringify(b.abstract.slice(-40))}`);
  say(`      存档 Box1 ${box == null ? "缺失" : box.length + " 字"}，末 40 字：${box == null ? "—" : JSON.stringify(box.replace(/飞卢小说网提醒您：[\s\S]*$/, "").trim().slice(-40))}`);
}

console.log(out.join("\n"));
fs.writeFileSync(path.join(DIR, "ch5_stats.txt"), out.join("\n"), "utf8");
