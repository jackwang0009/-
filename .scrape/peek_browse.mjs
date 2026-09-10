import fs from "node:fs";
import { extractState } from "./lib.mjs";

const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));

function walk(obj, path = "", out = []) {
  if (Array.isArray(obj)) {
    if (obj.length && obj[0] && typeof obj[0] === "object" && (obj[0].bookId || obj[0].book_id)) {
      out.push({ path, n: obj.length, sample: obj[0] });
    }
    obj.forEach((v, i) => v && typeof v === "object" && walk(v, `${path}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) if (v && typeof v === "object") walk(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

for (const f of [".scrape/newbook258.html", ".scrape/library.html", ".scrape/pt.html"]) {
  if (!fs.existsSync(f)) { console.log(f, "(missing)"); continue; }
  const st = extractState(fs.readFileSync(f, "utf8"));
  console.log(`\n=== ${f} state=${!!st} ===`);
  if (!st) continue;
  for (const x of walk(st)) {
    const nm = x.sample.bookName ?? x.sample.book_name;
    console.log(`  ${x.path.padEnd(36)} n=${String(x.n).padEnd(4)} ${JSON.stringify(nm)} PUA=${hasPUA(nm)}`);
  }
}
