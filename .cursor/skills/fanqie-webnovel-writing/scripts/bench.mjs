#!/usr/bin/env node
// 从本地番茄样本计算「阅读/章」基准线。
// 用法: node bench.mjs [最小字数] [最大字数]
//   例: node bench.mjs 150000 250000

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../../../.scrape/fq_books.json');

if (!fs.existsSync(DATA)) {
  console.error(`找不到数据文件: ${DATA}`);
  console.error('该文件由 .scrape/ 下的采集脚本生成。');
  process.exit(1);
}

const lo = Number(process.argv[2] ?? 150000);
const hi = Number(process.argv[3] ?? 250000);
if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
  console.error('字数区间无效，需为 最小字数 < 最大字数 的两个数字。');
  process.exit(1);
}

const books = Object.values(JSON.parse(fs.readFileSync(DATA, 'utf8')))
  .filter((b) => b.chapterTotal > 0 && b.wordNumber >= lo && b.wordNumber <= hi);

if (books.length < 10) {
  console.error(`该区间只有 ${books.length} 本，样本太小，结论不可信。`);
  process.exit(1);
}

const readPerChapter = (b) => b.readCount / b.chapterTotal;
const sorted = books.map(readPerChapter).sort((a, b) => a - b);
const pct = (p) => Math.round(sorted[Math.floor((sorted.length - 1) * p)]);

console.log(`区间 ${(lo / 10000).toFixed(1)}–${(hi / 10000).toFixed(1)} 万字，共 ${books.length} 本`);
console.log('');
console.log('  阅读/章 分位');
for (const [label, p] of [['最低', 0], ['25%', 0.25], ['中位数', 0.5], ['75%', 0.75], ['90%', 0.9], ['最高', 1]]) {
  console.log(`  ${label.padEnd(6)} ${String(pct(p)).padStart(6)}`);
}

const wordsPerChapter = books.map((b) => b.wordNumber / b.chapterTotal).sort((a, b) => a - b);
console.log('');
console.log(`  每章字数中位数 ${Math.round(wordsPerChapter[Math.floor(wordsPerChapter.length / 2)])}`);

console.log('');
console.log('  该区间前 10 名');
books
  .sort((a, b) => readPerChapter(b) - readPerChapter(a))
  .slice(0, 10)
  .forEach((b, i) => {
    const rpc = String(Math.round(readPerChapter(b))).padStart(5);
    console.log(`  ${String(i + 1).padStart(2)}. ${rpc} 阅读/章  ${b.chapterTotal} 章  ${b.bookName}`);
    console.log(`      首章: ${b.firstChapterTitle ?? '(无)'}`);
  });

console.log('');
console.log('  提醒：阅读/章 受书龄混淆，只在体量相近的书之间比较。');
