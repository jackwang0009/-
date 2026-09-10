// SCHEMA 第 1 节把「重开」限定为「同一段时间反复重来」义，但 simHit 只做子串匹配，判不了词义。
// 扩样到 158 本后，最早 5 本里冒出来的《重开地府》《玄幻之在万界重开之前登陆》都靠这个词进的，
// 而它们很可能是「重新开启地府」这类别的意思。这里把所有靠「重开」进来的书连简介一起列出来人工核。
import path from "node:path";
import { readJson } from "../lib.mjs";

const DIR = import.meta.dirname;
const { books } = readJson(path.join(DIR, "raw_ch5_feilu.json"));

// 「同一段时间反复重来」的正面信号：次数、轮回、回到、重来、模拟/推演同现
const LOOP = /重来|轮回|回到|再来一次|无数次|一次又一次|上一世|前世|重生|循环|读档|存档|倒带|时间回溯|多少次|第[一二三四五六七八九十百千万\d]+次/;
const OTHER_SIM = /模拟|推演|演算|沙盘|预演/;

const hits = books.filter((b) => {
  const blob = `${b.title}\n${b.abstract ?? ""}`;
  return blob.includes("重开");
});

console.log(`靠「重开」命中的共 ${hits.length} 本\n`);
for (const b of hits.sort((a, b) => a.firstPublishDate.localeCompare(b.firstPublishDate))) {
  const others = (b.simEvidence.keywords ?? []).filter((k) => k !== "重开");
  const blob = `${b.title}\n${b.abstract ?? ""}`;
  const loop = blob.match(LOOP) ?? [];
  const other = blob.match(new RegExp(OTHER_SIM.source, "g")) ?? [];
  const verdict = others.length || other.length ? "另有模拟词，不依赖「重开」" : loop.length ? "只有「重开」，但有循环义信号" : "只有「重开」，且无循环义信号 ← 重点看";
  console.log(`${b.firstPublishDate}  《${b.title}》  [${verdict}]`);
  console.log(`    simEvidence.keywords=[${b.simEvidence.keywords.join(",")}]  正文里另见模拟词=[${[...new Set(other)].join(",") || "无"}]  循环义信号=[${[...new Set(loop)].join(",") || "无"}]`);
  console.log(`    简介：${(b.abstract ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
  console.log();
}
