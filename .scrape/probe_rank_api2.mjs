import { UA } from "./lib.mjs";
import { readJson } from "./lib.mjs";

const ranks = readJson(".scrape/ranks.json", {});
const rv = ranks["1_1_258"]?.rankVersion;
console.log("rankVersion from cache:", rv);

const tries = [
  { app_id: 2503, rank_list_type: 1, category_id: 258, offset: 0, limit: 50, gender: 1, rank_version: rv },
  { app_id: 2503, rank_list_type: 1, category_id: 258, offset: 0, limit: 50, gender: 1, rank_version: rv, rankMold: 0 },
  { app_id: 2503, rank_list_type: 1, category_id: 258, offset: 10, limit: 50, gender: 1, rank_version: rv },
];

for (const v of tries) {
  const qs = new URLSearchParams(
    Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, String(x)]),
  );
  const res = await fetch(`https://fanqienovel.com/api/rank/category/list?${qs}`, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "zh-CN,zh;q=0.9",
      Accept: "application/json, text/plain, */*",
      Referer: "https://fanqienovel.com/rank/1_1_258",
    },
  });
  const t = await res.text();
  console.log("\n---", JSON.stringify(v));
  console.log("status", res.status, "len", t.length);
  console.log("RAW:", t.slice(0, 600));
  await new Promise((r) => setTimeout(r, 1200));
}
