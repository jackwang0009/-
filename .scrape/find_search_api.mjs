import fs from "node:fs";

const s = fs.readFileSync(".scrape/muye.js", "utf8");

const set = new Set();
let m;
const re = /["'`](\/[a-z0-9_\-/.]*(?:search|suggest|query)[a-z0-9_\-/.]*)["'`]/gi;
while ((m = re.exec(s))) set.add(m[1]);
console.log("--- path-like ---");
console.log([...set].sort().join("\n"));

const set2 = new Set();
const re2 =
  /https?:\/\/[a-z0-9.\-]*(?:novel|fanqie|fqnovel|snssdk|zijieapi)[a-z0-9.\-]*\/[a-z0-9_\-/.]*(?:search|suggest)[a-z0-9_\-/.]*/gi;
while ((m = re2.exec(s))) set2.add(m[0]);
console.log("--- absolute ---");
console.log([...set2].sort().join("\n"));
