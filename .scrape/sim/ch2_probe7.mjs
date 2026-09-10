// 探测七：(a) 分类表里有没有「模拟器」这类标签 id（有的话可以直接按标签browse）
// (b) library/book_list 的翻页深度与 total_count
import fs from "node:fs";
import { UA, sleep } from "../lib.mjs";

async function api(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "application/json, text/plain, */*", Referer: "https://fanqienovel.com/" },
  });
  const body = await res.text();
  if (!body.trimStart().startsWith("{")) return { _status: res.status, _len: body.length };
  return JSON.parse(body);
}

// (a) 分类/标签表
for (const url of [
  "https://fanqienovel.com/api/author/book/category_list/v0/",
  "https://fanqienovel.com/api/author/book/category_list/v0/?gender=1",
]) {
  const j = await api(url);
  console.log(`\n#### ${url}\n  code=${j.code} keys=${j.data ? Object.keys(j.data).join(",") : JSON.stringify(j).slice(0, 120)}`);
  if (j.data) {
    fs.writeFileSync(".scrape/sim/raw/ch2_probe_categories.json", JSON.stringify(j, null, 2), "utf8");
    const flat = [];
    const walk = (n, path) => {
      if (Array.isArray(n)) return n.forEach((x) => walk(x, path));
      if (n && typeof n === "object") {
        const nm = n.name ?? n.Name ?? n.category_name;
        const id = n.id ?? n.ObjectId ?? n.category_id;
        if (nm) flat.push({ id, name: nm, path });
        for (const [k, v] of Object.entries(n)) if (v && typeof v === "object") walk(v, nm ? `${path}/${nm}` : path);
      }
    };
    walk(j.data, "");
    console.log("  分类节点总数:", flat.length);
    const simTag = flat.filter((f) => /模拟|推演|演算|重开|沙盘|预演/.test(f.name));
    console.log("  命中模拟词的标签:", simTag.length ? JSON.stringify(simTag, null, 2) : "(无)");
    const cultTag = flat.filter((f) => /仙侠|修真|修仙|玄幻|洪荒|宗门/.test(f.name));
    console.log("  修仙类标签:", cultTag.map((c) => `${c.id}:${c.name}`).join(", ").slice(0, 600));
    break;
  }
  await sleep(1500);
}
await sleep(1500);

// (b) 翻页深度
const mk = (cat, pi, sort = 0) =>
  `https://fanqienovel.com/api/library/book_list?gender=1&category_id=${cat}&creation_status=-1&word_count=-1&sort=${sort}&page_index=${pi}&page_count=20`;
for (const [cat, pi] of [[1140, 0], [1140, 5], [1140, 30], [258, 0]]) {
  const j = await api(mk(cat, pi));
  const d = j.data || {};
  const list = d.book_list || [];
  console.log(`\n[cat=${cat} page=${pi}] code=${j.code} n=${list.length} has_more=${d.has_more} total=${d.total_count}`);
  if (list[0]) console.log(`   e.g. ${list[0].book_name} | ${list[0].author} | ${list[0].word_count}字 | absLen=${String(list[0].abstract || "").length}`);
  await sleep(1500);
}
