// 通道 5 探活第三轮：飞卢 GBK 搜索、纵横搜索接口/书页、17K 带 Cookie 会话。
import { sleep, UA } from "../lib.mjs";
import { getHtml, saveRaw, strip, gbkEncodeURI, log } from "./ch5_lib.mjs";
import fs from "node:fs";
import path from "node:path";

log("GBK(模拟) = " + gbkEncodeURI("模拟"));

const targets = [
  ["faloo-search-t1", `https://b.faloo.com/l_0_1.html?t=1&k=${gbkEncodeURI("模拟")}`],
  ["faloo-search-t3", `https://b.faloo.com/l_0_1.html?t=3&k=${gbkEncodeURI("模拟")}`],
  ["faloo-search-p2", `https://b.faloo.com/l_0_2.html?t=1&k=${gbkEncodeURI("模拟")}`],
  ["zh-book-real", "https://book.zongheng.com/book/1593259.html"],
  ["zh-store-c2", "http://book.zongheng.com/store/c2/c0/b0/u0/p1/v0/s9/t0/u0/i1/ALL.html"],
  ["zh-store-c3", "http://book.zongheng.com/store/c3/c0/b0/u0/p1/v0/s9/t0/u0/i1/ALL.html"],
];

for (const [name, url] of targets) {
  try {
    const r = await getHtml(url, 2);
    saveRaw(`p3_${name}`, r.html);
    const title = strip(r.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    log(`[ok]   ${name} enc=${r.enc} len=${r.html.length}`);
    log(`       title: ${title.slice(0, 90)}`);
  } catch (e) {
    log(`[fail] ${name} ${url} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}

// 17K：先访问首页拿站点 Cookie，再带着 Cookie + Referer 请求子页，看 WAF 是否放行
log("=== 17k 会话尝试");
const jar = new Map();
const eat = (res) => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
};
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const BROWSER = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
};

for (const [name, url, ref] of [
  ["home", "https://www.17k.com/", undefined],
  ["book", "https://www.17k.com/book/3038645.html", "https://www.17k.com/"],
  ["all", "https://www.17k.com/all/book/2_0_0_0_3_0_0_0_1.html", "https://www.17k.com/"],
  ["list-m", "https://m.17k.com/all/book/2_0_0_0_3_0_0_0_1.html", undefined],
  ["sitemap", "https://www.17k.com/sitemap.xml", undefined],
]) {
  try {
    const res = await fetch(url, { headers: { ...BROWSER, ...(ref ? { Referer: ref, "Sec-Fetch-Site": "same-origin" } : {}), ...(jar.size ? { Cookie: cookieHeader() } : {}) } });
    eat(res);
    const body = await res.text();
    const waf = /acw_sc__v2|aliyunwaf/i.test(body);
    log(`  ${name} ${res.status} len=${body.length} waf=${waf} cookies=[${[...jar.keys()].join(",")}]`);
    fs.writeFileSync(path.join(import.meta.dirname, "raw", `ch5_p3_17k-${name}.html`), body, "utf8");
    if (!waf) log(`    title: ${strip(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 80)}`);
  } catch (e) {
    log(`  ${name} FAIL ${e.message}`);
  }
  await sleep(1500);
}
