import fs from "node:fs";

const html = fs.readFileSync(process.argv[2], "utf8");
const out = [];
const push = (s) => out.push(String(s));

const title = html.match(/<title>([\s\S]*?)<\/title>/);
push("TITLE: " + (title ? title[1] : "n/a"));

for (const m of html.matchAll(/<meta[^>]+(name|property)="([^"]+)"[^>]*content="([^"]*)"/g)) {
  if (/title|description|keyword|og:/i.test(m[2])) push(`META ${m[2]}: ${m[3].slice(0, 300)}`);
}

const i = html.indexOf("window.__INITIAL_STATE__");
if (i >= 0) {
  const start = html.indexOf("{", i);
  // brace-match
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = start; k < html.length; k++) {
    const ch = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  push("state span: " + start + ".." + end);
  const raw = html.slice(start, end);
  try {
    const data = JSON.parse(raw);
    fs.writeFileSync(".scrape/book_state.json", JSON.stringify(data, null, 2));
    push("parsed OK. top keys: " + Object.keys(data).join(", "));
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && typeof v === "object") push(`  ${k}: ${Object.keys(v).slice(0, 40).join(", ")}`);
    }
  } catch (e) {
    push("parse fail: " + e.message);
    fs.writeFileSync(".scrape/book_state_raw.txt", raw);
  }
}
fs.writeFileSync(process.argv[3], out.join("\n"), "utf8");
