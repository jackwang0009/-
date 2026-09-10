// 探测六：确定 (a) /api/book/info?bookId= 的返回是否含 abstract（比 272KB 书页轻得多）
// (b) /api/library/book_list 的参数形态——这是替代搜索的扩池主路。
import fs from "node:fs";
import { UA, sleep } from "../lib.mjs";

const js = fs.readFileSync(".scrape/sim/raw/ch2_bundle_muye_a2c8e2a7.js", "utf8");

console.log("===== creation_status / tab_type 附近的参数构造");
for (const needle of ["creation_status", "NEW_LIBRARY_LIST", "category_id:"]) {
  let i = js.indexOf(needle), n = 0;
  while (i >= 0 && n < 3) {
    const ctx = js.slice(Math.max(0, i - 450), i + 450).replace(/\s+/g, " ");
    if (!ctx.includes("BOOKSHELF_ADD")) {
      console.log(`\n#### ${needle} @ ${i}`);
      console.log(ctx);
      n++;
    }
    i = js.indexOf(needle, i + 1);
  }
}

async function hit(name, url, accept = "application/json, text/plain, */*") {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: accept, Referer: "https://fanqienovel.com/" },
    });
    const body = await res.text();
    const isJson = body.trimStart().startsWith("{");
    console.log(`[${name}] ${res.status} len=${body.length} json=${isJson}`);
    if (isJson) {
      const j = JSON.parse(body);
      console.log(`   code=${j.code} msg=${j.message ?? ""} dataKeys=${j.data ? Object.keys(j.data).slice(0, 25).join(",") : "-"}`);
      return j;
    }
    return null;
  } catch (e) {
    console.log(`[${name}] FAIL ${e.message}`);
    return null;
  }
}

console.log("\n===== 实打");
const id = "7583949514948496409";
const info = await hit("book-info", `https://fanqienovel.com/api/book/info?bookId=${id}`);
if (info?.data) {
  fs.writeFileSync(".scrape/sim/raw/ch2_probe_bookinfo.json", JSON.stringify(info, null, 2), "utf8");
  const d = info.data;
  console.log("   bookName:", d.bookName, "| abstractLen:", String(d.abstract || "").length,
    "| wordNumber:", d.wordNumber, "| readCount:", d.readCount, "| categoryV2?", !!d.categoryV2);
}
await sleep(1500);

for (const [name, qs] of [
  ["lib-a", "gender=1&category_id=1140&creation_status=-1&word_count=-1&sort=0&page_index=0&page_count=20"],
  ["lib-b", "category_id=1140&page_index=0&page_count=20"],
  ["lib-c", "gender=1&category_id=1140&creation_status=-1&word_count=-1&sort=1&offset=0&limit=20"],
]) {
  const j = await hit(`library:${name}`, `https://fanqienovel.com/api/library/book_list?${qs}`);
  if (j?.data) {
    fs.writeFileSync(`.scrape/sim/raw/ch2_probe_lib_${name}.json`, JSON.stringify(j, null, 2), "utf8");
    const list = j.data.book_list || j.data.bookList || j.data.books || j.data.book_data || [];
    console.log("   list len:", list.length, list[0] ? "keys=" + Object.keys(list[0]).slice(0, 20).join(",") : "");
  }
  await sleep(1500);
}
