// 阶段 3 前置探测：确认 robots.txt 允许范围 + 站内搜索页/接口返回什么结构。
// 只打印，不落库。
import fs from "node:fs";
import { get, extractState, sleep } from "../lib.mjs";

const q = encodeURIComponent("模拟");
const targets = [
  ["robots", "https://fanqienovel.com/robots.txt"],
  ["search-html", `https://fanqienovel.com/search?query=${q}`],
  ["search-api", `https://fanqienovel.com/api/author/search/search_book/v1?filter=127%2C127%2C127%2C127&page_count=10&page_index=0&query_type=0&query_word=${q}`],
];

fs.mkdirSync(".scrape/sim/raw", { recursive: true });

for (const [name, url] of targets) {
  try {
    const body = await get(url, 2);
    fs.writeFileSync(`.scrape/sim/raw/ch2_probe_${name}.txt`, body, "utf8");
    console.log(`\n===== ${name} (${body.length} bytes) ${url}`);
    if (name === "robots") {
      console.log(body.slice(0, 1500));
    } else if (body.trimStart().startsWith("{")) {
      const j = JSON.parse(body);
      console.log(JSON.stringify(j).slice(0, 1200));
    } else {
      const st = extractState(body);
      console.log("has __INITIAL_STATE__:", !!st, st ? Object.keys(st) : "");
      if (st?.search) console.log("search keys:", Object.keys(st.search));
      const list = st?.search?.searchData ?? st?.search?.bookData ?? st?.search?.book_data;
      if (list) console.log("first item:", JSON.stringify(list?.[0] ?? list).slice(0, 1500));
    }
  } catch (e) {
    console.log(`\n===== ${name} FAILED: ${e.message}`);
  }
  await sleep(1500);
}
