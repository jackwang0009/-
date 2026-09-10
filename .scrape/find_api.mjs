import fs from "node:fs";
import { get, sleep } from "./lib.mjs";

const out = [];
const html = await get("https://fanqienovel.com/rank/1_2_258");
fs.writeFileSync(".scrape/rank_raw.html", html, "utf8");

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
out.push("scripts:\n" + scripts.join("\n"));

for (const m of html.matchAll(/["'`](\/api\/[A-Za-z0-9_\/\-{}$.]+)/g)) out.push("INLINE API: " + m[1]);

const seen = new Set();
for (const s of scripts) {
  const url = s.startsWith("//") ? "https:" + s : s.startsWith("http") ? s : "https://fanqienovel.com" + s;
  if (!/\.js($|\?)/.test(url)) continue;
  try {
    await sleep(400);
    const js = await get(url, 2);
    const hits = new Set();
    for (const m of js.matchAll(/["'`](\/api\/[A-Za-z0-9_\/\-]+)["'`]/g)) hits.add(m[1]);
    for (const m of js.matchAll(/["'`](\/reading\/[A-Za-z0-9_\/\-]+)["'`]/g)) hits.add(m[1]);
    for (const m of js.matchAll(/rank[A-Za-z_]{0,20}\s*[:=]\s*["'`]([^"'`]{4,80})["'`]/g)) hits.add("RANKSTR " + m[1]);
    if (hits.size) {
      out.push(`--- ${url} (${js.length}b) ---`);
      for (const h of hits) if (!seen.has(h)) { seen.add(h); out.push("  " + h); }
    }
  } catch (e) {
    out.push("ERR " + url + " " + e.message);
  }
}
fs.writeFileSync(".scrape/find_api.txt", out.join("\n"), "utf8");
