import fs from "node:fs";
import { get } from "./lib.mjs";

const url = "https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_a2c8e2a7.js";
let js;
if (fs.existsSync(".scrape/muye.js")) js = fs.readFileSync(".scrape/muye.js", "utf8");
else { js = await get(url); fs.writeFileSync(".scrape/muye.js", js, "utf8"); }

const out = [];
for (const needle of ["/api/rank/category/list", "/api/library/book_list", "/api/book/info", "/api/rank/recommend/list", "/api/reader/directory/detail"]) {
  let idx = -1;
  while ((idx = js.indexOf(needle, idx + 1)) >= 0) {
    out.push(`=== ${needle} @${idx} ===`);
    out.push(js.slice(Math.max(0, idx - 1200), idx + 900).replace(/\n/g, " "));
    out.push("");
  }
}
fs.writeFileSync(".scrape/api_ctx.txt", out.join("\n"), "utf8");
console.log("len", js.length);
