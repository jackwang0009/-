import fs from "node:fs";
import { get, extractState, sleep } from "./lib.mjs";

const out = [];
const html = await get("https://fanqienovel.com/rank/1_2_258");

// verify category nav mapping with correct decoding
for (const m of html.matchAll(/\/rank\/1_2_(\d+)"[^>]*>([\s\S]{0,60}?)<\/a>/g)) {
  out.push(`CAT ${m[1]} = ${m[2].replace(/<[^>]+>/g, "").trim()}`);
}

const st = extractState(html);
const r = st.rank;
out.push("--- rank keys: " + Object.keys(r).join(", "));
out.push("book_list len: " + r.book_list.length);
out.push("total_num: " + r.total_num);
out.push("defaultPage: " + JSON.stringify(r.defaultPage));
out.push("rankVersion: " + JSON.stringify(r.rankVersion));
out.push("rankTypeText: " + JSON.stringify(r.rankTypeText));
out.push("rankCategoryTypeList: " + JSON.stringify(r.rankCategoryTypeList)?.slice(0, 1500));
out.push("readRankList: " + JSON.stringify(r.readRankList)?.slice(0, 300));
out.push("newRankList: " + JSON.stringify(r.newRankList)?.slice(0, 300));

// try page 2
await sleep(1200);
const h2 = await get("https://fanqienovel.com/rank/1_2_258?page=2");
const s2 = extractState(h2);
out.push("page=2 first bookId: " + s2?.rank?.book_list?.[0]?.bookId + " len " + s2?.rank?.book_list?.length);
out.push("page=1 first bookId: " + r.book_list[0].bookId);

fs.writeFileSync(".scrape/probe_rank.txt", out.join("\n"), "utf8");
