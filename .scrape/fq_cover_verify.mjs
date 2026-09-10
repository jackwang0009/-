import crypto from "node:crypto";
import { readJson, sleep } from "./lib.mjs";

// 验证通道 2 的结论：番茄签名封面链存在免签名永久形式。
// 要验三件事：① 免签版可访问 ② 字节流与签名版完全一致 ③ p9 主机是否真的没有免签版
const books = Object.values(readJson(".scrape/fq_books.json", {}))
  .filter((b) => !b._err && b.thumbUrl)
  .slice(0, 12);

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);

const grab = async (url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return { ok: false, note: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, sha: sha(buf), len: buf.length, ct: r.headers.get("content-type") };
  } catch (e) {
    return { ok: false, note: e.message };
  }
};

let same = 0, p9naive = 0, p6ok = 0;
for (const b of books) {
  const signed = b.thumbUrl;
  const host = (signed.match(/https:\/\/([^/]+)/) || [, ""])[1];
  const path = signed.split("?")[0].replace(/https:\/\/[^/]+/, "");

  const naive = `https://${host.replace("-novel-sign.", "-novel.")}${path}`;
  const p6 = `https://p6-novel.byteimg.com${path}`;

  const a = await grab(signed); await sleep(1100);
  const n = await grab(naive); await sleep(1100);
  const c = host.startsWith("p6") ? n : await grab(p6);
  if (!host.startsWith("p6")) await sleep(1100);

  if (n.ok === false && host.startsWith("p9")) p9naive++;
  if (c.ok) p6ok++;
  if (a.ok && c.ok && a.sha === c.sha) same++;

  console.log(
    `${host.slice(0, 14)} | 签名 ${a.ok ? a.sha : a.note} | 同前缀免签 ${n.ok ? n.sha : n.note} | 归一p6 ${c.ok ? c.sha : c.note} | ${a.ok && c.ok && a.sha === c.sha ? "字节一致" : "不一致"}`
  );
}
console.log(`\n样本 ${books.length}：归一到 p6 可访问 ${p6ok}，与签名版字节一致 ${same}，p9 同前缀免签失败 ${p9naive}`);
