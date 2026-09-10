// 按通道 1 新口径实测封面直链：必须 HTTP 200 且 Content-Type 为 image/*。
// 顺便验证签名参数（x-expires/x-signature）去掉后是否仍可访问——关系到归档器能不能长期复用这批链接。
import fs from "node:fs";
import { UA, sleep, parseCsv } from "./lib.mjs";

const rows = parseCsv(fs.readFileSync("docs/书库/番茄-档案.csv", "utf8")).filter((r) => r.length > 1);
const body = rows.slice(1);

async function probe(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://fanqienovel.com/" } });
    const ct = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
    return { status: res.status, ct, bytes: buf.length || len, ok: res.ok && /^image\//i.test(ct) && buf.length > 1024 };
  } catch (e) {
    return { status: 0, ct: "", bytes: 0, ok: false, err: e.message };
  }
}

const results = [];
let signedOk = 0, strippedOk = 0;

for (const r of body) {
  const no = r[0], url = r[16];
  if (!url) { results.push({ no, state: "空" }); continue; }

  const a = await probe(url);
  await sleep(1200);

  const stripped = url.split("?")[0];
  const b = await probe(stripped);
  await sleep(1200);

  if (a.ok) signedOk++;
  if (b.ok) strippedOk++;
  const exp = (url.match(/x-expires=(\d+)/) || [, ""])[1];
  results.push({
    no,
    state: "有",
    signed: `${a.status}/${a.ct.split(";")[0]}/${a.bytes}B${a.ok ? " OK" : " FAIL"}`,
    stripped: `${b.status}/${b.ct.split(";")[0]}/${b.bytes}B${b.ok ? " OK" : " FAIL"}`,
    expires: exp ? new Date(Number(exp) * 1000).toISOString() : "",
  });
  console.log(`#${no} 签名链 ${results[results.length - 1].signed} | 去签名 ${results[results.length - 1].stripped} | 到期 ${results[results.length - 1].expires}`);
}

const withUrl = results.filter((r) => r.state === "有").length;
console.log(`\n有封面URL ${withUrl} 行；签名链实测通过 ${signedOk}，去掉签名后仍通过 ${strippedOk}`);
fs.writeFileSync(".scrape/cover_probe.json", JSON.stringify(results, null, 2), "utf8");
