import fs from "node:fs";
import { extractState } from "./lib.mjs";

const st = extractState(fs.readFileSync(".scrape/home.html", "utf8"));
const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));

function walk(obj, path = "", out = []) {
  if (Array.isArray(obj)) {
    if (obj.length && obj[0] && typeof obj[0] === "object" && (obj[0].bookId || obj[0].book_id)) {
      out.push({ path, n: obj.length, sample: obj[0] });
    }
    obj.forEach((v, i) => typeof v === "object" && v && walk(v, `${path}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) if (v && typeof v === "object") walk(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

const found = walk(st);
console.log("book lists found:", found.length);
for (const f of found) {
  const nm = f.sample.bookName ?? f.sample.book_name;
  console.log(`  ${f.path.padEnd(42)} n=${String(f.n).padEnd(4)} e.g. ${f.sample.bookId ?? f.sample.book_id} ${JSON.stringify(nm)} PUA=${hasPUA(nm)}`);
}
