import fs from "node:fs";
const js = fs.readFileSync(".scrape/muye.js", "utf8");
const out = [];

for (const needle of ["/api/rank/category/list", "/api/library/book_list"]) {
  const idx = js.indexOf(needle);
  const before = js.slice(Math.max(0, idx - 120), idx);
  const km = before.match(/([A-Za-z0-9_$]+)\s*:\s*$/);
  out.push(`${needle} -> key candidate: ${km ? km[1] : "?"}  |ctx: ${JSON.stringify(before.slice(-80))}`);
}

// usages of NEW_LIBRARY_LIST
for (const key of ["NEW_LIBRARY_LIST", "RANK_CATEGORY", "rank/category"]) {
  let idx = -1, n = 0;
  while ((idx = js.indexOf(key, idx + 1)) >= 0 && n < 6) {
    n++;
    out.push(`\n--- ${key} @${idx} ---`);
    out.push(js.slice(Math.max(0, idx - 1400), idx + 1000).replace(/\n/g, " "));
  }
}
fs.writeFileSync(".scrape/api_keys2.txt", out.join("\n"), "utf8");
