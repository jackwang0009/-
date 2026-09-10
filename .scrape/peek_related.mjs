import fs from "node:fs";

const st = JSON.parse(fs.readFileSync(".scrape/book_state.json", "utf8"));
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

console.log("page keys:", Object.keys(st.page ?? {}).sort().join(", "));
console.log("\n--- book lists anywhere in state ---");
for (const f of walk(st)) {
  const nm = f.sample.bookName ?? f.sample.book_name;
  console.log(`  ${f.path.padEnd(40)} n=${String(f.n).padEnd(4)} ${f.sample.bookId ?? f.sample.book_id} ${JSON.stringify(nm)} PUA=${hasPUA(nm)}`);
}
