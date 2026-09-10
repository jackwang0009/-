import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(".scrape/book_state.json", "utf8"));
const p = data.page;
const out = [];
for (const [k, v] of Object.entries(p)) {
  let s;
  if (Array.isArray(v)) {
    s = `Array(${v.length}) first=` + JSON.stringify(v[0])?.slice(0, 600);
  } else if (v && typeof v === "object") {
    s = JSON.stringify(v).slice(0, 600);
  } else {
    s = String(v).slice(0, 400);
  }
  out.push(`${k}: ${s}`);
}
out.push("=== rank obj (newRankList / rankCategoryTypeList) ===");
out.push("rankCategoryTypeList: " + JSON.stringify(data.rank.rankCategoryTypeList).slice(0, 3000));
fs.writeFileSync(".scrape/page_fields.txt", out.join("\n"), "utf8");
