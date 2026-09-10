import fs from "node:fs";
import { get, extractState, sleep, readJson, writeJson, asArray } from "./lib.mjs";

const idsFile = process.argv[2] || ".scrape/bookids.json";
const outFile = process.argv[3] || ".scrape/books.json";
const rawIds = readJson(idsFile, []);
const ids = (Array.isArray(rawIds) ? rawIds : Object.values(rawIds)).filter(Boolean).map(String);
const books = readJson(outFile, {});
const log = [];

const hasPUA = (s) => /[\uE000-\uF8FF]/.test(String(s ?? ""));
const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

let n = 0;
for (const id of ids) {
  n++;
  if (books[id] && !books[id]._err) continue;
  try {
    const html = await get(`https://fanqienovel.com/page/${id}`);
    const st = extractState(html);
    const p = st?.page;
    if (!p || String(p.bookId) !== String(id)) throw new Error("page mismatch/missing");

    const titleTag = stripTags((html.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1]);
    const metaKw = (html.match(/<meta[^>]+name="keywords"[^>]*content="([^"]*)"/) || [, ""])[1];

    const chapters = asArray(p.chapterListWithVolume).flatMap(asArray);
    const first = chapters.length
      ? chapters.reduce((a, b) => (Number(a.realChapterOrder) <= Number(b.realChapterOrder) ? a : b))
      : null;

    books[id] = {
      bookId: id,
      bookName: p.bookName,
      bookNamePUA: hasPUA(p.bookName),
      titleTag,
      metaKw: metaKw.slice(0, 200),
      author: p.author || p.authorName,
      authorPUA: hasPUA(p.author || p.authorName),
      authorId: p.authorId,
      wordNumber: Number(p.wordNumber || 0),
      readCount: Number(p.readCount || 0),
      chapterTotal: Number(p.chapterTotal || chapters.length || 0),
      creationStatus: String(p.creationStatus),
      lastPublishTime: Number(p.lastPublishTime || 0),
      lastChapterTitle: p.lastChapterTitle,
      firstChapterTitle: first?.title ?? "",
      firstPassTime: Number(first?.firstPassTime || 0),
      categories: asArray(p.categoryV2).map((c) => ({ id: c.ObjectId, name: c.Name, dim: c.Dim })),
      thumbUrl: p.thumbUrl || "",
      // 仅作本地判重/概括参考，官方简介不进交付 CSV
      abstractLen: String(p.abstract || "").length,
      url: `https://fanqienovel.com/page/${id}`,
    };
    log.push(`${n}/${ids.length} OK ${id} ${books[id].bookName} | ch=${books[id].chapterTotal} first=${books[id].firstPassTime}`);
  } catch (e) {
    books[id] = { bookId: id, _err: e.message, url: `https://fanqienovel.com/page/${id}` };
    log.push(`${n}/${ids.length} ERR ${id} ${e.message}`);
  }
  if (n % 10 === 0) writeJson(outFile, books);
  await sleep(1100);
}
writeJson(outFile, books);
const ok = Object.values(books).filter((b) => !b._err).length;
log.push(`\nDONE ok=${ok} err=${Object.values(books).length - ok}`);
fs.writeFileSync(outFile.replace(/\.json$/, "") + ".log", log.join("\n"), "utf8");
console.log("DONE ok=" + ok);
