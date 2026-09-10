// 通道 5 探活第七轮：纵横搜索 JSON 字段、纵横书页首发日期在哪。
import fs from "node:fs";
import path from "node:path";
import { sleep, UA } from "../lib.mjs";
import { getHtml, strip, log } from "./ch5_lib.mjs";

const res = await fetch("https://search.zongheng.com/search/book?keyword=%E6%A8%A1%E6%8B%9F&pageNum=1", {
  headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://search.zongheng.com/" },
});
const j = await res.json();
fs.writeFileSync(path.join(import.meta.dirname, "raw", "ch5_p7_zh-search.json"), JSON.stringify(j, null, 2), "utf8");
const d = j.data?.datas ?? j.data;
log("total=" + d.total + " totalPage=" + d.totalPage + " pageSize=" + d.pageSize);
log("=== 第 1 条全字段");
log(JSON.stringify(d.list[0], null, 2));
log("=== 前 10 条书名");
for (const b of d.list.slice(0, 10)) log("  " + b.bookId + "  " + String(b.name).replace(/<[^>]+>/g, "") + "  | " + (b.categoryName ?? b.category ?? "?"));
await sleep(1200);

log("\n=== 纵横书页找首发/上架日期");
const r = await getHtml("https://book.zongheng.com/book/1040153.html", 2);
fs.writeFileSync(path.join(import.meta.dirname, "raw", "ch5_p7_zh-book2.html"), r.html, "utf8");
log("len=" + r.html.length);
for (const kw of ["首发", "上架", "创建", "发布", "开书", "签约"]) {
  const i = r.html.indexOf(kw);
  log(`  [${kw}] ` + (i > 0 ? strip(r.html.slice(i - 200, i + 200)).replace(/\n/g, " ") : "(未出现)"));
}
const dates = [...new Set([...r.html.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]))].sort();
log("  页面全部日期: " + dates.join(", "));
log("=== 书页数值块");
const ni = r.html.indexOf("总点击");
log(strip(r.html.slice(ni - 900, ni + 500)));
