import crypto from "node:crypto";
import { UA } from "./lib.mjs";

const url =
  "https://p6-novel.byteimg.com/novel-pic/p2o0a2b996f16f47236c6f3f0af6bd9ceb4~tplv-resize:225:300.image";
const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://fanqienovel.com/" } });
const ct = res.headers.get("content-type") || "";
const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
console.log("status :", res.status);
console.log("type   :", ct.split(";")[0]);
console.log("bytes  :", buf.length);
console.log("sha256 :", crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16));
console.log("判定   :", res.ok && /^image\//i.test(ct) && buf.length > 8000 ? "通过" : "不通过");
