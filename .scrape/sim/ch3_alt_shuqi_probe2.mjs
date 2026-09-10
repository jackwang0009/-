// 通道 3 · 书旗 403 复核。probe 一轮 6 个 URL 全 403（含首页、含它 robots 里自己公示的 sitemap）。
// 要分清两件事：(1) 昨天 robots.txt 还能 200 拿到 23325 字节，今天还能不能——能，说明站方只是
// 对内容路径收紧；不能，说明整站对本代理关门。(2) 是否瞬时。
// 本脚本刻意不走 lib.mjs 的 get()：它对 403 会退避 60 秒重试，而这里只是探活，单发一次即可，
// 对站方压力更小。绝不加 Cookie/Referer 去绕——那属于规避反爬。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UA, sleep } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");
fs.mkdirSync(RAW, { recursive: true });

const URLS = [
  ["robots", "https://www.shuqi.com/robots.txt"],
  ["home", "https://www.shuqi.com/"],
  ["m-home", "https://m.shuqi.com/"],
  ["book-shape", "https://www.shuqi.com/book/8158305.html"],
];

const out = [];
for (const [name, url] of URLS) {
  let rec = { name, url };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "text/html,application/xhtml+xml,text/plain" },
      redirect: "follow",
    });
    const body = await res.text();
    rec.status = res.status;
    rec.bytes = body.length;
    rec.finalUrl = res.url;
    rec.server = res.headers.get("server");
    rec.title = body.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? null;
    rec.head = body.slice(0, 200).replace(/\s+/g, " ");
    if (body) fs.writeFileSync(path.join(RAW, `ch3_shuqi_recheck_${name}.txt`), body, "utf8");
  } catch (e) {
    rec.error = String(e.message);
  }
  out.push(rec);
  console.log(
    `[${name}] ${url}\n  status=${rec.status ?? "ERR " + rec.error} bytes=${rec.bytes ?? "-"} server=${rec.server ?? "-"}` +
      `\n  final=${rec.finalUrl ?? "-"}\n  head=${rec.head ?? "-"}`,
  );
  await sleep(1500);
}
fs.writeFileSync(path.join(DIR, "ch3_shuqi_recheck.json"), JSON.stringify(out, null, 2), "utf8");
