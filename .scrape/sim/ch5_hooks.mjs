// 通道 5：openingHook。只取第一章免费试读页公开可见的前 200 字，不登录、不碰 VIP 章节。
// 命中付费/登录提示一律写 null，不猜。
import path from "node:path";
import { sleep, writeJson, readJson, UA } from "../lib.mjs";
import { getHtml, strip, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const OUT = path.join(RAW, "ch5_stage_hooks.json");
const GAP = 1300;
const PAYWALL = /VIP|订阅|登录后|购买本章|付费章节|开通/;

const hooks = readJson(OUT, {});
const faloo = readJson(path.join(RAW, "ch5_stage_faloo.json"), { picked: [] });
const zh = readJson(path.join(RAW, "ch5_stage_zongheng.json"), { picked: [], books: {} });

// 飞卢：第一章固定 b.faloo.com/{id}_1.html
for (const id of faloo.picked ?? []) {
  const key = `faloo:${id}`;
  if (key in hooks) continue;
  try {
    const r = await getHtml(`https://b.faloo.com/${id}_1.html`, 2);
    const body = /<div[^>]+id="content"[^>]*>([\s\S]*?)<\/div>/i.exec(r.html)?.[1] ?? /<div class="noveContent">([\s\S]*?)<\/div>/i.exec(r.html)?.[1] ?? "";
    const txt = strip(body).replace(/\s+/g, "");
    hooks[key] = txt.length >= 40 && !PAYWALL.test(txt.slice(0, 60)) ? txt.slice(0, 200) : null;
    log(`[hook] faloo ${id} ${hooks[key] ? hooks[key].length + " 字" : "null"}`);
  } catch (e) {
    hooks[key] = null;
    log(`[hook] faloo ${id} 失败 ${e.status ?? ""} ${e.message}`);
  }
  writeJson(OUT, hooks);
  await sleep(GAP);
}

// 纵横：目录页第一章链接 → 章节页
for (const id of zh.picked ?? []) {
  const key = `zh:${id}`;
  if (key in hooks) continue;
  try {
    const toc = await getHtml(`https://book.zongheng.com/showchapter/${id}.html`, 2);
    // 目录页的章节链接既有 read.zongheng.com 也有 book.zongheng.com 两种主机，都收
    const first = /(?:https?:)?\/\/(?:read|book)\.zongheng\.com\/chapter\/\d+\/(\d+)\.html/.exec(toc.html);
    if (!first) throw new Error("目录页没有章节链接");
    await sleep(GAP);
    const r = await getHtml(`https://read.zongheng.com/chapter/${id}/${first[1]}.html`, 2);
    const body = /<div class="content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(r.html)?.[1] ?? /<div class="reader_box[^"]*">([\s\S]*?)<\/div>/i.exec(r.html)?.[1] ?? "";
    const txt = strip(body).replace(/\s+/g, "");
    hooks[key] = txt.length >= 40 && !PAYWALL.test(txt.slice(0, 60)) ? txt.slice(0, 200) : null;
    log(`[hook] zh ${id} ${hooks[key] ? hooks[key].length + " 字" : "null"}`);
  } catch (e) {
    hooks[key] = null;
    log(`[hook] zh ${id} 失败 ${e.status ?? ""} ${e.message}`);
  }
  writeJson(OUT, hooks);
  await sleep(GAP);
}

const got = Object.values(hooks).filter(Boolean).length;
log(`[hook] 完成 ${got}/${Object.keys(hooks).length} 本拿到开篇`);
