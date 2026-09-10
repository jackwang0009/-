import fs from "node:fs";
import { extractState } from "./lib.mjs";

const st = extractState(fs.readFileSync(".scrape/rank_raw.html", "utf8"));
const r = st?.rank ?? {};
console.log("=== rankCategoryTypeList ===");
console.log(JSON.stringify(r.rankCategoryTypeList, null, 1).slice(0, 4000));
console.log("=== readRankList (first) ===");
console.log(JSON.stringify(r.readRankList, null, 1).slice(0, 1500));
console.log("=== newRankList (first) ===");
console.log(JSON.stringify(r.newRankList, null, 1).slice(0, 1500));
