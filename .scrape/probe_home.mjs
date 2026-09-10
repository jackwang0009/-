import fs from "node:fs";
import { get, extractState, sleep } from "./lib.mjs";

const out = [];
for (const [label, url] of [
  ["home", "https://fanqienovel.com/"],
  ["library", "https://fanqienovel.com/library"],
  ["newbook258", "https://fanqienovel.com/rank/1_1_258"],
]) {
  try {
    await sleep(800);
    const html = await get(url);
    fs.writeFileSync(`.scrape/${label}.html`, html, "utf8");
    out.push(`\n########## ${label} (${html.length}b) ##########`);
    // all nav-ish anchors with text
    const seen = new Set();
    for (const m of html.matchAll(/href="([^"]+)"[^>]*>([\s\S]{0,40}?)<\/a>/g)) {
      const t = m[2].replace(/<[^>]+>/g, "").trim();
      if (!t) continue;
      const k = m[1] + "|" + t;
      if (seen.has(k)) continue;
      seen.add(k);
      if (/榜|库|分类|排行/.test(t)) out.push(`  LINK ${m[1]} => ${t}`);
    }
    // headings / section titles
    const hs = [...html.matchAll(/>([^<>]{2,12}榜)</g)].map((m) => m[1]);
    out.push("  榜 texts: " + [...new Set(hs)].join(" | "));
    const st = extractState(html);
    if (st) {
      out.push("  state keys: " + Object.keys(st).join(", "));
      if (st.home) {
        for (const [k, v] of Object.entries(st.home)) {
          if (Array.isArray(v) && v.length) out.push(`    home.${k}: Array(${v.length}) sample=${JSON.stringify(v[0]).slice(0, 200)}`);
          else if (v && typeof v === "object") out.push(`    home.${k}: obj ${Object.keys(v).slice(0,15).join(",")}`);
        }
      }
      if (st.rank) out.push("    rank.book_list len=" + (st.rank.book_list?.length ?? "n/a") + " total=" + st.rank.total_num);
      if (st.library) out.push("    library: " + JSON.stringify(st.library).slice(0, 500));
    } else out.push("  no state");
  } catch (e) {
    out.push(`${label} ERR ${e.message}`);
  }
}
fs.writeFileSync(".scrape/probe_home.txt", out.join("\n"), "utf8");
