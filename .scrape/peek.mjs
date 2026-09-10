import fs from "node:fs";

const html = fs.readFileSync(process.argv[2], "utf8");
const i = html.indexOf("window.__INITIAL_STATE__");
console.log("index:", i, "len:", html.length);
if (i >= 0) console.log(JSON.stringify(html.slice(i, i + 3000)));

const j = html.indexOf("bookName");
console.log("--- bookName ctx ---");
if (j >= 0) console.log(JSON.stringify(html.slice(Math.max(0, j - 1500), j + 1500)));
