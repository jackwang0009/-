import fs from "node:fs";
import { extractState } from "./lib.mjs";

const st = extractState(fs.readFileSync(".scrape/rank_raw.html", "utf8"));
const list = st?.rank?.book_list ?? [];
console.log("rank keys:", Object.keys(st?.rank ?? {}).join(","));
console.log("book_list len:", list.length);
if (list.length) {
  console.log("entry keys:", Object.keys(list[0]).join(","));
  const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));
  for (const b of list.slice(0, 5)) {
    console.log(
      `  ${b.bookId} | name=${JSON.stringify(b.bookName)} PUA=${hasPUA(b.bookName)} | author=${JSON.stringify(b.author)} PUA=${hasPUA(b.author)}`,
    );
  }
}
