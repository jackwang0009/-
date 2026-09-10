// 通道 5 离线自检：拿探活期存下的完整飞卢书页验详情解析，别拿正式请求试错。
import fs from "node:fs";
import path from "node:path";
import { strip, toWords, toNum } from "./ch5_lib.mjs";

const h = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_p4_faloo-book.html"), "utf8");
const bookId = "1118376";
const meta = (k) => new RegExp(`<meta[^>]+name="${k}"[^>]*content="([^"]*)"`).exec(h)?.[1] ?? null;
const flat = strip(h).replace(/\n+/g, " ");

console.log("og:novel:category =", meta("og:novel:category"));
console.log("og:novel:author   =", meta("og:novel:author"));
console.log("og:novel:update   =", meta("og:novel:update_time"));
console.log("click_cnt         =", toNum(meta("og:novel:click_cnt")));
console.log("小说子类          =", /小说子类[：:]\s*([^\s入]+)/.exec(flat)?.[1] ?? null);
console.log("入站时间          =", /入站时间[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(flat)?.[1] ?? null);
console.log("标签原文          =", JSON.stringify(/标签[：:]\s*([^\n]{0,80})/.exec(flat)?.[1] ?? null));
console.log("字数              =", toWords(/(?:总字数|字数)[：:]\s*([\d.]+\s*万?字?)/.exec(flat)?.[1]));
console.log("章节数            =", new Set([...h.matchAll(new RegExp(`${bookId}_(\\d+)\\.html`, "g"))].map((m) => m[1])).size);
console.log("状态              =", /已完本|已完成/.test(flat) ? "完结" : /连载中|连载/.test(flat) ? "连载" : "unknown");
const ab = strip(/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(h)?.[1] ?? "");
console.log("简介长度          =", ab.length);
console.log("简介头            =", ab.slice(0, 100).replace(/\n/g, " / "));
console.log("--- 入站时间原文块");
const i = h.indexOf("入站时间");
console.log(h.slice(i - 400, i + 500));
