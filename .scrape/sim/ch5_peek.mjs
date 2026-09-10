// 通道 5 结构侦察：把探活存下来的 HTML 拆开看，确认选择器与 URL 形态。
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "raw");
const read = (n) => fs.readFileSync(path.join(dir, `ch5_probe_${n}.html`), "utf8");
const show = (t) => console.log(t);

show("=== zongheng robots\n" + read("zongheng-robots"));
show("=== 17k robots\n" + read("17k-robots"));

const faloo = read("faloo-list-b");
show("=== faloo 分类导航链接");
for (const m of [...faloo.matchAll(/href="(?:https?:)?\/\/b\.faloo\.com\/(y_[\d_]+\.html)"[^>]*>\s*([^<]{1,20})\s*</g)].slice(0, 40)) {
  show(`  ${m[1]}  ${m[2].trim()}`);
}
show("=== faloo 书目条 (前 3 条原样)");
const items = faloo.match(/<div class="[^"]*(?:TwoBox|kindtitle|listbox)[^"]*"[\s\S]{0,1200}?<\/div>/g);
show(items ? items.slice(0, 2).join("\n---\n") : "(未匹配到预期 class)");
show("=== faloo 书页链接样例");
for (const m of [...faloo.matchAll(/href="(?:https?:)?\/\/b\.faloo\.com\/(\d+)\.html"[^>]*>([^<]{1,30})</g)].slice(0, 12)) {
  show(`  id=${m[1]}  ${m[2].trim()}`);
}

show("=== zongheng search 结构");
const zs = read("zh-search");
for (const m of [...zs.matchAll(/href="(?:https?:)?\/\/book\.zongheng\.com\/book\/(\d+)\.html"[^>]*>([\s\S]{0,60}?)</g)].slice(0, 12)) {
  show(`  id=${m[1]}  ${m[2].replace(/\s+/g, " ").trim()}`);
}
show("--- zh search 片段");
show(zs.slice(zs.indexOf("search-result") > 0 ? zs.indexOf("search-result") : 3000, (zs.indexOf("search-result") > 0 ? zs.indexOf("search-result") : 3000) + 2500));

show("=== 17k search 结构");
const ks = read("17k-search");
show(ks.slice(0, 3000));
