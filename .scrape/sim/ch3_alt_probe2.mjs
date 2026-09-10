// 通道 3 · 396 本空字段定性：是选择器漂了，还是站方本来就不给？
// 判法：这 396 本在列表页全都拿得到字数（见 ch3_alt_diag 输出），所以数据在站上是有的；
// 剩下要分的是「书页换了模板」还是「书页返回了别的东西」。抓少量原始 HTML 落盘对比。
// 抓 6 本空批 + 3 本正常批，够看模板差异，不多打站。
import { get, sleep, readJson } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");
fs.mkdirSync(RAW, { recursive: true });

const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const byId = new Map(cand.books.map((b) => [b.id, b]));
const ids = Object.keys(pages);
const empty = ids.filter((id) => !pages[id].error && !pages[id].abstract);
const good = ids.filter((id) => !pages[id].error && pages[id].abstract);

// 等距取样，别只看开头那几本（开头可能恰好是同一批老书）
const pick = (arr, n) => Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)]).filter(Boolean);
const targets = [
  ...pick(empty, 6).map((id) => ["空", id]),
  ...pick(good, 3).map((id) => ["常", id]),
];

const probes = [
  ["datum块", /<div class="datum">/],
  ["p.intro", /<p class="intro"/],
  ["sortList", /<div class="sortList">/],
  ["bookIntro", /bookIntro/],
  ["目录N章", /目录[\s\S]{0,40}?（\d+章）/],
  ["下架/审核", /下架|审核中|暂不可见|已删除|不存在/],
  ["JS挑战", /window\.location|document\.cookie\s*=|_0x|acw_sc|buid/],
  ["登录墙", /请登录|立即登录|login/i],
];

for (const [kind, id] of targets) {
  const b = byId.get(id);
  const url = `https://www.tadu.com/book/${id}/`;
  let html, err = null;
  try {
    html = await get(url, 2);
  } catch (e) {
    err = String(e.status ?? e.message);
    html = "";
  }
  const file = path.join(RAW, `ch3_alt_probe_${kind === "空" ? "empty" : "ok"}_${id}.html`);
  if (html) fs.writeFileSync(file, html, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
  const hits = probes.filter(([, re]) => re.test(html)).map(([n]) => n);
  console.log(
    `[${kind}] ${id} ${b?.title ?? ""} — ${err ? "ERR " + err : `${html.length} 字节`} | <title>${title}` +
      `\n      命中: ${hits.join(", ") || "(无)"}`,
  );
  // 空批的页面里，字数到底以什么形式出现？把「万字」附近的原文抠出来看
  if (kind === "空" && html) {
    const around = [...html.matchAll(/.{80}万\s*字?.{40}/g)].slice(0, 2).map((m) => m[0].replace(/\s+/g, " "));
    for (const a of around) console.log(`      「万字」上下文: …${a}…`);
    const cls = [...html.matchAll(/class="(intro[^"]*|[^"]*intro)"/g)].map((m) => m[1]);
    if (cls.length) console.log(`      含 intro 的 class: ${[...new Set(cls)].join(" / ")}`);
  }
  await sleep(1200);
}
console.log("\n原始 HTML 已落盘 .scrape/sim/raw/ch3_alt_probe_*.html");
