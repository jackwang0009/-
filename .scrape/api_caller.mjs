import fs from "node:fs";
const js = fs.readFileSync(".scrape/muye.js", "utf8");
const out = [];
for (const needle of ["rank_list_type", "rankMold", "rank_version"]) {
  let idx = -1, n = 0;
  while ((idx = js.indexOf(needle, idx + 1)) >= 0 && n < 10) {
    n++;
    out.push(`\n===== ${needle} @${idx} =====`);
    out.push(js.slice(Math.max(0, idx - 1100), idx + 800).replace(/\n/g, " "));
  }
}
fs.writeFileSync(".scrape/api_caller.txt", out.join("\n"), "utf8");
