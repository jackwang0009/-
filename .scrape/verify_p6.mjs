// 核实通道 1 的说法：签名封面链归一到 p6-novel.byteimg.com 去掉 query 后，
// 是否还能取到「逐字节相同」的图。自己验一遍再改交付文件。
import fs from "node:fs";
import crypto from "node:crypto";
import { UA, sleep, parseCsv } from "./lib.mjs";

export const toP6 = (url) =>
  url
    .split("?")[0]
    .replace(/^https:\/\/p\d+-novel(?:-sign)?\.byteimg\.com\//, "https://p6-novel.byteimg.com/");

async function grab(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://fanqienovel.com/" } });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) return { ok: false, status: res.status, ct, bytes: 0, sha: "" };
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    ok: /^image\//i.test(ct) && buf.length > 0,
    status: res.status,
    ct: ct.split(";")[0],
    bytes: buf.length,
    sha: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16),
  };
}

const rows = parseCsv(fs.readFileSync("docs/书库/番茄-档案.csv", "utf8")).filter((r) => r.length > 1).slice(1);
let same = 0, p6ok = 0, n = 0, small = [];

for (const r of rows) {
  const signed = r[16];
  if (!signed) continue;
  n++;
  const p6 = toP6(signed);
  const a = await grab(signed);
  await sleep(1200);
  const b = await grab(p6);
  await sleep(1200);
  if (b.ok) p6ok++;
  const match = a.sha && a.sha === b.sha;
  if (match) same++;
  if (b.ok && b.bytes < 10240) small.push({ no: r[0], bytes: b.bytes });
  console.log(
    `#${String(r[0]).padStart(2)} p6=${b.status}/${b.ct}/${String(b.bytes).padStart(6)}B ` +
      `sha ${match ? "一致" : "不一致"} (签名 ${a.sha} / 免签 ${b.sha})`,
  );
}

console.log(`\n共 ${n} 张：p6 免签可访问 ${p6ok}/${n}，与签名版 sha256 一致 ${same}/${n}`);
console.log(small.length ? `体积 <10240 的：${small.map((s) => `#${s.no}=${s.bytes}B`).join(", ")}` : "无 <10240 的图");
