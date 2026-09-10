// 站内搜索模块。走官方 search_book 接口（resolve_ids.mjs 已验证过的头部/参数形式：
// filter=127 单值、Accept: application/json、带 Referer）。lib.mjs 的 get() 发的是
// text/html 的 Accept，这个接口会回 200 + 空 body，所以这里单独实现请求，
// 但退避纪律与 lib.mjs 一致：403/429/空 body 一律退避 60 秒。
import { pathToFileURL } from "node:url";
import { UA, sleep, writeJson } from "../lib.mjs";

export async function searchBook(word, pageIndex = 0, pageCount = 10, tries = 3) {
  const url =
    "https://fanqienovel.com/api/author/search/search_book/v1" +
    `?filter=127&page_count=${pageCount}&page_index=${pageIndex}` +
    `&query_type=0&query_word=${encodeURIComponent(word)}`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "zh-CN,zh;q=0.9",
          Accept: "application/json, text/plain, */*",
          Referer: "https://fanqienovel.com/",
        },
      });
      if (!res.ok) {
        const e = new Error("HTTP " + res.status);
        e.status = res.status;
        throw e;
      }
      const body = await res.text();
      if (!body.length) {
        const e = new Error("empty body (soft rate limit)");
        e.softLimit = true;
        throw e;
      }
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
      const throttled = e.status === 403 || e.status === 429 || e.softLimit;
      if (throttled) console.warn(`  [throttled ${e.status ?? "empty-200"}] backing off 60s`);
      await sleep(throttled ? 60000 : 1500 * (i + 1));
    }
  }
  throw lastErr;
}

export const searchList = (j) =>
  j?.data?.search_book_data_list || j?.data?.book_data_list || [];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const word = process.argv[2] || "模拟";
  const j = await searchBook(word, 0, 10);
  const list = searchList(j);
  console.log(`code=${j?.code} total=${j?.data?.total_count} n=${list.length}`);
  if (list.length) {
    console.log("\nkeys:", Object.keys(list[0]).join(","));
    console.log("\nfirst item:\n", JSON.stringify(list[0], null, 2).slice(0, 2500));
  }
  writeJson(".scrape/sim/raw/ch2_probe_search.json", j);
}
