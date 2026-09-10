import { get, extractState } from "./lib.mjs";

const id = "7326876174989134910";
const html = await get(`https://fanqienovel.com/page/${id}`, 2);
console.log("html len", html.length);
const st = extractState(html);
console.log("state?", !!st);
const p = st?.page;
console.log("page?", !!p);
if (p) {
  console.log("page.bookId :", JSON.stringify(p.bookId), "expected", id, "match:", String(p.bookId) === id);
  console.log("bookName    :", JSON.stringify(p.bookName));
  console.log("author      :", JSON.stringify(p.author));
  console.log("wordNumber  :", p.wordNumber, "readCount:", p.readCount);
  console.log("chapterTotal:", p.chapterTotal, "creationStatus:", p.creationStatus);
} else {
  console.log("top keys:", Object.keys(st ?? {}).join(","));
  console.log("title tag:", (html.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1].slice(0, 200));
}
