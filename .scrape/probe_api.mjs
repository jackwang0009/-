import fs from "node:fs";
import { get, extractState, sleep, UA } from "./lib.mjs";

const out = [];
const html = await get("https://fanqienovel.com/rank/1_2_258");
const st = extractState(html);
const rankVersion = st.rank.rankVersion;
out.push("rankVersion " + rankVersion);

async function api(params) {
  const q = new URLSearchParams(params).toString();
  const url = "https://fanqienovel.com/api/rank/category/list?" + q;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://fanqienovel.com/rank/1_2_258" },
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { _raw: txt.slice(0, 300) }; }
}

// 1) basic pagination test
const r1 = await api({ app_id: 2503, rank_list_type: 2, offset: 10, limit: 10, category_id: 258, rank_version: rankVersion, gender: 1 });
out.push("--- offset10 type2 cat258 ---");
out.push("code=" + r1.code + " msg=" + r1.message + " total=" + r1?.data?.total_num + " len=" + r1?.data?.book_list?.length);
out.push("rankTypeText=" + JSON.stringify(r1?.data?.rankTypeText));
if (r1?.data?.book_list?.[0]) {
  const b = r1.data.book_list[0];
  out.push("first: pos=" + b.currentPos + " id=" + b.bookId + " read=" + b.read_count + " words=" + b.wordNumber);
  out.push("fields: " + Object.keys(b).join(", "));
}
if (r1._raw) out.push("RAW: " + r1._raw);

// 2) sweep rank_list_type
for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  await sleep(700);
  const r = await api({ app_id: 2503, rank_list_type: t, offset: 0, limit: 3, category_id: 258, rank_version: rankVersion, gender: 1 });
  out.push(`type=${t} code=${r.code} total=${r?.data?.total_num} len=${r?.data?.book_list?.length} text=${JSON.stringify(r?.data?.rankTypeText)} first=${r?.data?.book_list?.[0]?.bookId}`);
}

// 3) limit bigger?
await sleep(700);
const r3 = await api({ app_id: 2503, rank_list_type: 2, offset: 0, limit: 100, category_id: 258, rank_version: rankVersion, gender: 1 });
out.push("limit100 -> len=" + r3?.data?.book_list?.length + " total=" + r3?.data?.total_num);

fs.writeFileSync(".scrape/probe_api.txt", out.join("\n"), "utf8");
