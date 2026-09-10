// 通道 5 离线自检其二：字数块、状态标记、标签链接的确切写法。
import fs from "node:fs";
import path from "node:path";
import { strip } from "./ch5_lib.mjs";

const h = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_p4_faloo-book.html"), "utf8");
const i = h.indexOf("T-R-Md-Bobx1");
console.log("=== 字数/阅读数块\n" + h.slice(i - 100, i + 1400));
console.log("\n=== flat 里的「已写」");
const flat = strip(h).replace(/\n+/g, " ");
console.log(/已有(\d+)人读过已写(\d+)个字/.exec(flat));
console.log("\n=== 状态字样");
for (const kw of ["连载中", "已完本", "完本", "连载"]) {
  const k = h.indexOf(kw);
  console.log(`  [${kw}] ` + (k > 0 ? strip(h.slice(k - 150, k + 100)).replace(/\n/g, " ") : "(未出现)"));
}
console.log("\n=== 标签链接");
console.log([...h.matchAll(/<a class="LXbq"[^>]*title="([^"]+)"/g)].map((m) => m[1]));
