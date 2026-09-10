import { UA } from "./lib.mjs";

const base = "https://fanqienovel.com/api/rank/category/list";
const variants = [
  { app_id: 2503, rank_list_type: 1, category_id: 258, offset: 0, limit: 50, gender: 1 },
  { app_id: 1967, rank_list_type: 1, category_id: 258, offset: 0, limit: 50, gender: 1 },
  { rank_list_type: 1, category_id: 258, offset: 0, limit: 50, gender: 1 },
];

for (const v of variants) {
  const qs = new URLSearchParams(Object.entries(v).map(([k, x]) => [k, String(x)]));
  const url = `${base}?${qs}`;
  try {
    const res = await fetch(url, {
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
    if (t.length) {
      let j = null;
      try { j = JSON.parse(t); } catch {}
      if (j) {
        const list = j?.data?.book_list ?? j?.data?.list ?? [];
        console.log("code", j.code, "msg", j.message, "n", Array.isArray(list) ? list.length : typeof list);
        if (Array.isArray(list) && list.length) {
          console.log("keys", Object.keys(list[0]).slice(0, 25).join(","));
          console.log("sample", list[0].book_id ?? list[0].bookId, JSON.stringify(list[0].book_name ?? list[0].bookName));
        }
      } else console.log("raw", t.slice(0, 300));
    }
  } catch (e) {
    console.log("\n---", JSON.stringify(v), "FAIL", e.message);
  }
  await new Promise((r) => setTimeout(r, 1200));
}
