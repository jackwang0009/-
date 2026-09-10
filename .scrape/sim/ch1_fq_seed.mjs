// 通道 1：零请求摸底。扫 .scrape/fq_books.json 已有的 360 本番茄榜单书，
// 看「模拟」这一类在番茄头部样本里的密度，给通道 2 当起点。
// 只读既有资产，只在 .scrape/sim/ 下写自己的 ch1_* 产物。

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const books = readJson(path.join(DIR, "..", "fq_books.json"), {});

const SIM = ["模拟", "推演", "演算", "沙盘", "预演", "重开", "人生模拟", "无限重生"];
const CULT = ["仙侠", "修真", "玄幻", "洪荒", "修仙"];
const CULT_TEXT = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根"];

const hits = [];
for (const b of Object.values(books)) {
  const cats = (b.categories ?? []).map((c) => c.name);
  // fq_books.json 没有 abstract 正文，metaKw 是这里唯一能代替简介的文本面。
  const hay = `${b.bookName ?? ""} ${b.metaKw ?? ""}`;
  const simWords = SIM.filter((w) => hay.includes(w));
  if (!simWords.length) continue;
  const matchedIn = [];
  if (SIM.some((w) => (b.bookName ?? "").includes(w))) matchedIn.push("title");
  if (SIM.some((w) => (b.metaKw ?? "").includes(w)) && !matchedIn.includes("title")) matchedIn.push("abstract");
  const isCult =
    cats.some((c) => CULT.some((k) => c.includes(k))) || CULT_TEXT.some((k) => hay.includes(k));
  hits.push({
    bookName: b.bookName,
    author: b.author,
    wordNumber: b.wordNumber,
    readCount: b.readCount,
    categories: cats,
    simWords,
    matchedIn,
    isCult,
    url: b.url,
  });
}

const total = Object.keys(books).length;
const cult = hits.filter((h) => h.isCult);
const titleHit = hits.filter((h) => h.matchedIn.includes("title"));
const med = (arr) => {
  const s = arr.filter(Number.isInteger).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

writeJson(path.join(DIR, "ch1_fq_seed.json"), { total, hits });

console.log(`番茄存量样本 ${total} 本`);
console.log(`命中模拟词 ${hits.length} 本，其中同时满足修仙属性 ${cult.length} 本`);
console.log(`模拟词进书名的 ${titleHit.length} 本 / ${hits.length}`);
console.log(`命中书字数中位数 ${med(hits.map((h) => h.wordNumber))}，全样本 ${med(Object.values(books).map((b) => b.wordNumber))}`);
console.log("");
console.log("同时满足两条判据的：");
for (const h of cult.sort((a, b) => (b.readCount ?? 0) - (a.readCount ?? 0))) {
  console.log(`  ${h.bookName} / ${h.author} ${h.wordNumber}字 在读${h.readCount} [${h.categories.join(",")}] 命中:${h.simWords.join("+")}@${h.matchedIn.join(",")}`);
}
console.log("");
console.log("只中模拟不中修仙（nearMiss 预览）：");
for (const h of hits.filter((x) => !x.isCult)) {
  console.log(`  ${h.bookName} [${h.categories.join(",")}] 命中:${h.simWords.join("+")}`);
}
