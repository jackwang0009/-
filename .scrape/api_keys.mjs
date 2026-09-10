import fs from "node:fs";
const js = fs.readFileSync(".scrape/muye.js", "utf8");
const out = [];

// find KEY:"/api/rank/category/list" style entries
for (const m of js.matchAll(/([A-Z0-9_]{3,40})\s*:\s*"(\/api\/(?:rank|library|book)[^"]*)"/g)) {
  out.push(`KEY ${m[1]} = ${m[2]}`);
}
out.push("=========== usages ===========");
for (const key of ["RANK_CATEGORY_LIST", "GET_RANK_CATEGORY_LIST", "LIBRARY_BOOK_LIST", "GET_LIBRARY_BOOK_LIST", "BOOK_INFO", "RANK_LIST"]) {
  let idx = -1;
  let n = 0;
  while ((idx = js.indexOf("." + key, idx + 1)) >= 0 && n < 4) {
    n++;
    out.push(`--- .${key} @${idx} ---`);
    out.push(js.slice(Math.max(0, idx - 900), idx + 700).replace(/\n/g, " "));
  }
}
fs.writeFileSync(".scrape/api_keys.txt", out.join("\n"), "utf8");
