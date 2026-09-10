import fs from "node:fs";
import { get, extractState, sleep, UA } from "./lib.mjs";

const out = [];
const html = await get("https://fanqienovel.com/rank/1_2_258");
const st = extractState(html);
const rankVersion = st.rank.rankVersion;
const cookie = ""; // none

async function api(params, label) {
  const q = new URLSearchParams(params).toString();
  const url = "https://fanqienovel.com/api/rank/category/list?" + q;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://fanqienovel.com/rank/1_2_258",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "x-requested-with": "XMLHttpRequest",
      },
    });
    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { return out.push(`${label} NONJSON ${txt.slice(0,150)}`); }
    out.push(`${label} code=${j.code} total=${j?.data?.total_num} len=${j?.data?.book_list?.length} first=${j?.data?.book_list?.[0]?.bookId}`);
    return j;
  } catch (e) { out.push(`${label} ERR ${e.message}`); }
}

for (const app_id of [1967, 2503, 0]) {
  for (const rlt of [1, 2, 3]) {
    await sleep(500);
    await api({ app_id, rank_list_type: rlt, offset: 10, limit: 10, category_id: 258, rank_version: rankVersion, gender: 1 }, `app=${app_id} rlt=${rlt}`);
  }
}
out.push("--- with rankMold ---");
for (const mold of [0, 1, 2, 3]) {
  await sleep(500);
  await api({ app_id: 1967, rank_list_type: 2, offset: 10, limit: 10, category_id: 258, rank_version: rankVersion, gender: 1, rankMold: mold }, `mold=${mold}`);
}
out.push("--- no rank_version ---");
await sleep(500);
await api({ app_id: 1967, rank_list_type: 2, offset: 10, limit: 10, category_id: 258, gender: 1 }, "norv");
await sleep(500);
await api({ app_id: 2503, rank_list_type: 2, offset: 10, limit: 10, category_id: 258, gender: 1 }, "norv2503");

fs.writeFileSync(".scrape/probe_api2.txt", out.join("\n"), "utf8");
