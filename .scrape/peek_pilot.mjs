import { readJson } from "./lib.mjs";

const books = readJson(".scrape/books.json", {});
const cases = [
  { no: 13, baseTitle: "时停", baseAuthor: "六个葫芦", baseWan: 231, id: "7504849932138859545" },
  { no: 26, baseTitle: "那妖魔是姜大人！", baseAuthor: "八爪触手怪", baseWan: 217.5, id: "7544766518324644889" },
  { no: 25, baseTitle: "不死帝师", baseAuthor: "一只榴莲3号", baseWan: 527.8, id: "7228940788351110182" },
];

for (const c of cases) {
  const b = books[c.id];
  if (!b || b._err) { console.log(`#${c.no} 抓取失败`); continue; }
  const wan = (b.wordNumber / 10000).toFixed(1);
  const diff = (((wan - c.baseWan) / c.baseWan) * 100).toFixed(1);
  console.log(`\n=== #${c.no} 底本《${c.baseTitle}》/ ${c.baseAuthor} / ${c.baseWan}万 ===`);
  console.log(`  官方书名 : ${b.bookName}`);
  console.log(`  官方作者 : ${b.author}   ${b.author === c.baseAuthor ? "✔ 作者一致" : "✘ 作者不一致"}`);
  console.log(`  字数     : ${wan}万  (与底本差 ${diff}%)`);
  console.log(`  章节/状态: ${b.chapterTotal} 章 / ${b.creationStatus === "0" ? "已完结" : "连载中"}`);
  console.log(`  分类     : ${(b.categories || []).map((x) => x.name).join("/")}`);
  console.log(`  首发     : ${b.firstPassTime ? new Date(b.firstPassTime * 1000).toISOString().slice(0, 10) : ""}`);
}
