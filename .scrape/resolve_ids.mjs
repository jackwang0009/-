// 把底本书名解析成番茄 bookId，只走官方 search_book 接口。
// 用法: node .scrape/resolve_ids.mjs "书名1" "书名2" ...
import { pathToFileURL } from "node:url";
import { UA, sleep } from "./lib.mjs";

const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));
const norm = (s) =>
  String(s ?? "")
    .replace(/[\s，,。.！!？?、·:：""''《》()（）\-—_~]/g, "")
    .toLowerCase();

export async function searchBook(title) {
  const url =
    "https://fanqienovel.com/api/author/search/search_book/v1" +
    `?filter=127&page_count=10&page_index=0&query_type=0&query_word=${encodeURIComponent(title)}`;
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
  return res.json();
}

export function pickMatch(title, list) {
  const want = norm(title);
  const cands = (list || []).map((b) => ({
    bookId: String(b.book_id ?? b.bookId ?? ""),
    bookName: b.book_name ?? b.bookName ?? "",
    author: b.author ?? "",
    raw: b,
  }));
  const exact = cands.find((c) => norm(c.bookName) === want);
  if (exact) return { ...exact, matchType: "exact" };
  const contains = cands.find((c) => norm(c.bookName) && norm(c.bookName).includes(want));
  if (contains) return { ...contains, matchType: "contains" };
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const t of process.argv.slice(2)) {
    try {
      const j = await searchBook(t);
      const list = j?.data?.search_book_data_list || j?.data?.book_data_list || [];
      console.log(`\n=== ${t} === code=${j?.code} total=${j?.data?.total_count} n=${list.length}`);
      if (list.length) console.log("keys:", Object.keys(list[0]).join(","));
      for (const b of list.slice(0, 5)) {
        const nm = b.book_name ?? b.bookName;
        console.log(
          `  ${b.book_id ?? b.bookId} | ${nm} | ${b.author} | PUA=${hasPUA(nm) || hasPUA(b.author)}`,
        );
      }
      const m = pickMatch(t, list);
      console.log("  -> match:", m ? `${m.matchType} ${m.bookId} ${m.bookName}` : "NONE");
    } catch (e) {
      console.log(`\n=== ${t} === FAIL ${e.message}`);
    }
    await sleep(1100);
  }
}
