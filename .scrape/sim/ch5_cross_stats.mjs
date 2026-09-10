// 通道 5 · 跨站对照草稿的取数底稿。只读 raw_ch5_feilu.json 与 raw_ch4_qimao.json（通道 4 的文件，只读不改）。
import path from "node:path";
import fs from "node:fs";
import { readJson } from "../lib.mjs";

const DIR = import.meta.dirname;
const out = [];
const say = (...a) => out.push(a.join(" "));
const med = (xs) => {
  const s = xs.filter(Number.isInteger).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const wan = (n) => (n == null ? "—" : (n / 10000).toFixed(1));
const q = (xs, p) => {
  const s = xs.filter(Number.isInteger).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

const { books } = readJson(path.join(DIR, "raw_ch5_feilu.json"));
const fal = books.filter((b) => b.platform === "faloo");
const zh = books.filter((b) => b.platform === "zongheng");

// ── 七猫：只读引用通道 4 的交付
const qmFile = path.join(DIR, "raw_ch4_qimao.json");
const qm = fs.existsSync(qmFile) ? readJson(qmFile) : null;
const qmBooks = qm?.books ?? [];
say(`[\u4e03\u732b] ${qm ? `meta.status=${qm.meta?.status ?? "?"}  books=${qmBooks.length}` : "\u6587\u4ef6\u4e0d\u5b58\u5728"}`);
if (qmBooks.length) {
  const w = qmBooks.map((b) => b.wordCount);
  const st = qmBooks.reduce((a, b) => ((a[b.status] = (a[b.status] ?? 0) + 1), a), {});
  say(`[\u4e03\u732b] \u5b57\u6570 \u4e2d\u4f4d ${wan(med(w))} \u4e07 / \u6700\u5c0f ${wan(Math.min(...w.filter(Number.isInteger)))} \u4e07 / \u6700\u5927 ${wan(Math.max(...w.filter(Number.isInteger)))} \u4e07 / \u7f3a\u5931 ${w.filter((x) => !Number.isInteger(x)).length}`);
  say(`[\u4e03\u732b] \u72b6\u6001 ${JSON.stringify(st)}`);
  const SIM = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "重开", "人生模拟"];
  say(`[\u4e03\u732b] \u6a21\u62df\u8bcd\u5165\u4e66\u540d ${qmBooks.filter((b) => SIM.some((s) => b.title.includes(s))).length}/${qmBooks.length}`);
  say(`[\u4e03\u732b] \u4ec5\u7b80\u4ecb\u547d\u4e2d\uff08matchedIn \u4e0d\u542b title\uff09${qmBooks.filter((b) => !b.simEvidence?.matchedIn?.includes("title")).length}`);
  const y = qmBooks.reduce((a, b) => ((a[String(b.firstPublishDate).slice(0, 4)] = (a[String(b.firstPublishDate).slice(0, 4)] ?? 0) + 1), a), {});
  say(`[\u4e03\u732b] \u9996\u53d1\u5e74\u4efd ${Object.entries(y).sort().map(([k, v]) => `${k}\u00d7${v}`).join(" ")}`);
}

// ── 一、年代形状：分站看，才知道 2023 那个坑是不是单站伪影
say("");
for (const [name, s] of [["\u98de\u5362", fal], ["\u7eb5\u6a2a", zh]]) {
  const y = s.reduce((a, b) => ((a[b.firstPublishDate.slice(0, 4)] = (a[b.firstPublishDate.slice(0, 4)] ?? 0) + 1), a), {});
  say(`[\u5e74\u4ee3] ${name} ${Object.entries(y).sort().map(([k, v]) => `${k}\u00d7${v}`).join("  ")}`);
}
// 飞卢这 46 本是按点击降序取的头部，点击随时间累积，样本天然偏老书——这条要能量化。
say("");
say("[\u91c7\u6837\u504f] \u98de\u5362 46 \u672c\u6309\u5217\u8868\u9875\u70b9\u51fb\u964d\u5e8f\u53d6\u5934\u90e8\uff0c\u70b9\u51fb\u968f\u65f6\u95f4\u7d2f\u79ef\uff0c\u770b\u5404\u5e74\u4efd\u7684\u70b9\u51fb\u4e2d\u4f4d\uff1a");
const byYear = {};
for (const b of fal) (byYear[b.firstPublishDate.slice(0, 4)] ??= []).push(b.popularity?.raw);
for (const [y, v] of Object.entries(byYear).sort()) say(`    ${y} n=${v.length} \u70b9\u51fb\u4e2d\u4f4d ${med(v) ?? "—"}`);

// ── 二、平台形态：字数下限那个差到底是什么
say("");
for (const [name, s] of [["\u98de\u5362", fal], ["\u7eb5\u6a2a", zh]]) {
  const w = s.map((b) => b.wordCount);
  const done = s.filter((b) => b.status === "完结").length;
  const unk = s.filter((b) => b.status === "unknown").length;
  say(`[\u5f62\u6001] ${name} n=${s.length} \u5b57\u6570 P10 ${wan(q(w, 0.1))} / P25 ${wan(q(w, 0.25))} / \u4e2d\u4f4d ${wan(med(w))} / P75 ${wan(q(w, 0.75))} \u4e07  \u5b8c\u7ed3 ${done}\uff08${Math.round((done / s.length) * 100)}%\uff09 unknown ${unk}`);
}
const small = fal.filter((b) => b.wordCount < 400000);
say(`[\u5f62\u6001] \u98de\u5362\u4f4e\u4e8e 40 \u4e07\u5b57\u7684 ${small.length} \u672c\uff08\u7eb5\u6a2a\u6700\u5c0f\u5c31\u662f 39.6 \u4e07\uff0c\u62ff\u8fd9\u6761\u7ebf\u5bf9\u9f50\uff09\uff1a`);
for (const b of small.sort((a, b) => a.wordCount - b.wordCount)) {
  const span = (new Date(b.lastUpdateDate) - new Date(b.firstPublishDate)) / 864e5;
  say(`    ${wan(b.wordCount)} \u4e07 \u00b7 ${b.status} \u00b7 ${b.firstPublishDate}\u2192${b.lastUpdateDate}\uff08\u5b58\u6d3b ${Math.round(span)} \u5929\uff09\u00b7 ${b.chapterTotal ?? "?"} \u7ae0 \u00b7 \u300a${b.title}\u300b`);
}
const spanOf = (s) => med(s.map((b) => Math.round((new Date(b.lastUpdateDate) - new Date(b.firstPublishDate)) / 864e5)));
say(`[\u5f62\u6001] \u9996\u53d1\u2192\u672b\u66f4 \u4e2d\u4f4d\u5b58\u6d3b\u5929\u6570\uff1a\u98de\u5362 ${spanOf(fal)} \u5929 / \u7eb5\u6a2a ${spanOf(zh)} \u5929`);
say(`[\u5f62\u6001] \u7ae0\u5747\u5b57\u6570\u4e2d\u4f4d\uff1a\u98de\u5362 ${med(fal.filter((b) => b.chapterTotal).map((b) => Math.round(b.wordCount / b.chapterTotal)))} / \u7eb5\u6a2a ${med(zh.filter((b) => b.chapterTotal).map((b) => Math.round(b.wordCount / b.chapterTotal)))}`);

// ── 三、判据留痕：模拟是卖点还是里子
say("");
for (const [name, s] of [["\u98de\u5362", fal], ["\u7eb5\u6a2a", zh]]) {
  const onlyAbs = s.filter((b) => !b.simEvidence.matchedIn.includes("title"));
  say(`[\u5356\u70b9/\u91cc\u5b50] ${name} \u4ec5\u7b80\u4ecb\u547d\u4e2d\uff08\u4e66\u540d\u65e0\u6a21\u62df\u8bcd\uff09${onlyAbs.length}/${s.length}\uff1a${onlyAbs.map((b) => b.title).join("\u3001") || "—"}`);
}

// ── 取数可信度自查：写结论前先确认排序键与日期字段本身站得住
say("");
const stage = readJson(path.join(DIR, "raw", "ch5_stage_faloo.json"));
const metricMix = stage.harvested.list.reduce((a, b) => ((a[b.listClickMetric ?? "null"] = (a[b.listClickMetric ?? "null"] ?? 0) + 1), a), {});
say(`[\u81ea\u67e5] \u98de\u5362\u6392\u5e8f\u952e listClick \u7684\u53e3\u5f84\u5206\u5e03\uff08\u5019\u9009\u6c60 ${stage.harvested.list.length} \u672c\uff09\uff1a${JSON.stringify(metricMix)}`);
say("       picked.sort \u7528\u7684\u5c31\u662f\u8fd9\u4e2a listClick\u3002\u82e5\u603b/\u5468/\u65e5\u6df7\u5728\u4e00\u8d77\uff0c\u300c\u53d6\u524d 46 \u540d\u300d\u5c31\u4e0d\u662f\u4e00\u4e2a\u5e72\u51c0\u7684\u5934\u90e8\u3002");
say("");
say("[\u81ea\u67e5] \u9690\u542b\u65e5\u66f4\uff08wordCount \u00f7 \u9996\u53d1\u5230\u672b\u66f4\u5929\u6570\uff09\uff0c>2 \u4e07\u5b57/\u5929\u57fa\u672c\u4e0d\u53ef\u80fd\uff0c\u662f\u65e5\u671f\u5b57\u6bb5\u4e0d\u53ef\u4fe1\u7684\u4fe1\u53f7\uff1a");
for (const [name, s] of [["\u98de\u5362", fal], ["\u7eb5\u6a2a", zh]]) {
  const rates = s.map((b) => {
    const d = Math.max(1, Math.round((new Date(b.lastUpdateDate) - new Date(b.firstPublishDate)) / 864e5));
    return { t: b.title, r: Math.round(b.wordCount / d), d, b };
  }).sort((x, y) => y.r - x.r);
  const bad = rates.filter((x) => x.r > 20000);
  say(`    ${name} \u9690\u542b\u65e5\u66f4\u4e2d\u4f4d ${med(rates.map((x) => x.r))} \u5b57/\u5929\uff0c\u8d85 2 \u4e07\u5b57/\u5929\u7684 ${bad.length}/${s.length} \u672c`);
  for (const x of bad.slice(0, 5)) say(`      ${x.r} \u5b57/\u5929  ${wan(x.b.wordCount)} \u4e07\u5b57 \u00f7 ${x.d} \u5929  ${x.b.firstPublishDate}\u2192${x.b.lastUpdateDate}  \u300a${x.t}\u300b`);
}

console.log(out.join("\n"));
fs.writeFileSync(path.join(DIR, "ch5_cross_stats.txt"), out.join("\n"), "utf8");
