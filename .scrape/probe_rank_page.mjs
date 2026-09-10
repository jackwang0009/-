import { get, extractState, sleep } from "./lib.mjs";

const urls = [
  "https://fanqienovel.com/rank/1_1_258",
  "https://fanqienovel.com/rank/1_1_258?page=2",
  "https://fanqienovel.com/rank/1_1_258/2",
  "https://fanqienovel.com/rank/1_1_258?offset=10&limit=100",
];

for (const u of urls) {
  try {
    const h = await get(u, 1);
    const st = extractState(h);
    const l = st?.rank?.book_list ?? [];
    console.log(
      u,
      "| n=", l.length,
      "| total=", st?.rank?.total_num,
      "| defaultPage=", JSON.stringify(st?.rank?.defaultPage),
      "| first=", l[0]?.bookId,
      "| last=", l[l.length - 1]?.bookId,
    );
  } catch (e) {
    console.log(u, "FAIL", e.message);
  }
  await sleep(1200);
}
