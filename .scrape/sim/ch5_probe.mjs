// 通道 5 探活：飞卢 / 纵横 / 17K。只探不抓，确认可达性、编码、URL 参数含义。
import { sleep } from "../lib.mjs";
import { getHtml, saveRaw, strip, log } from "./ch5_lib.mjs";

const targets = [
  ["faloo-robots", "https://b.faloo.com/robots.txt"],
  ["zongheng-robots", "https://www.zongheng.com/robots.txt"],
  ["17k-robots", "https://www.17k.com/robots.txt"],

  // 飞卢：列表页 URL 是数字段拼的，先各探一页看参数落在哪一位
  ["faloo-list-a", "https://b.faloo.com/y_0_0_0_0_0_0_1.html"],
  ["faloo-list-b", "https://b.faloo.com/y_1_0_0_0_0_0_1.html"],
  ["faloo-list-c", "https://b.faloo.com/y_0_0_0_0_1_0_1.html"],
  ["faloo-search", "https://so.faloo.com/search?key=%E6%A8%A1%E6%8B%9F"],

  // 纵横
  ["zh-store", "https://www.zongheng.com/store/c1/c0/b0/u0/p1/v0/s9/t0/ALL.html"],
  ["zh-search", "https://search.zongheng.com/s?keyword=%E6%A8%A1%E6%8B%9F"],

  // 17K
  ["17k-lib", "https://all.17k.com/lib/book/2_0_0_0_0_0_0_0_1.html"],
  ["17k-search", "https://search.17k.com/search.xhtml?c.st=0&c.q=%E6%A8%A1%E6%8B%9F"],
];

for (const [name, url] of targets) {
  try {
    const r = await getHtml(url, 2);
    saveRaw(`probe_${name}`, r.html);
    const title = strip(r.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    log(`[ok]   ${name} enc=${r.enc} len=${r.html.length} final=${r.url}`);
    log(`       title: ${title}`);
  } catch (e) {
    log(`[fail] ${name} ${url} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}
