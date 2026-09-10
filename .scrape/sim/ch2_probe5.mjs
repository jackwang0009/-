// 探测五：搜索接口被安全 SDK 挡住（页面挂了 secsdk/captcha），放弃搜索路线。
// 改找「批量解析 bookId -> 书名/简介」的端点：一次请求能覆盖多本，才有可能把
// 榜单扩出来的大 ID 池筛成模拟流命中集。
import fs from "node:fs";
import { UA, sleep } from "../lib.mjs";

const js = fs.readFileSync(".scrape/sim/raw/ch2_bundle_muye_a2c8e2a7.js", "utf8");

console.log("===== 参数名出现次数");
for (const p of ["gender", "category_id", "creation_status", "word_count", "sort",
  "page_index", "page_count", "book_ids", "book_id", "need_book_info", "tab_type"]) {
  const c = (js.match(new RegExp("\\b" + p + "\\b", "g")) || []).length;
  console.log(`   ${p.padEnd(18)} ${c}`);
}

console.log("\n===== simple/info & multidetail 调用上下文");
for (const needle of ["/api/book/simple/info", "/api/bookshelf/multidetail", "/api/book/info"]) {
  const i = js.indexOf(needle);
  console.log(`\n#### ${needle} @ ${i}`);
  if (i < 0) continue;
  // 常量表里那一处没用，找第二处（真正的调用点）
  let j = js.indexOf(needle, i + 1);
  const at = j > 0 ? j : i;
  console.log(js.slice(Math.max(0, at - 600), at + 600).replace(/\s+/g, " "));
}

// 实际打一次看看
const ids = ["7583949514948496409", "7641506817385712665"];
const tries = [
  ["simple-info-single", `https://fanqienovel.com/api/book/simple/info?book_id=${ids[0]}`],
  ["simple-info-multi", `https://fanqienovel.com/api/book/simple/info?book_id=${ids.join(",")}`],
  ["multidetail", `https://fanqienovel.com/api/bookshelf/multidetail?book_ids=${ids.join(",")}`],
  ["book-info", `https://fanqienovel.com/api/book/info?book_id=${ids[0]}`],
];

console.log("\n===== 实打");
for (const [name, url] of tries) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: "application/json, text/plain, */*",
        Referer: "https://fanqienovel.com/",
      },
    });
    const body = await res.text();
    console.log(`[${name}] ${res.status} len=${body.length}`);
    if (body.length) console.log("   ", body.slice(0, 600));
  } catch (e) {
    console.log(`[${name}] FAIL ${e.message}`);
  }
  await sleep(1500);
}
