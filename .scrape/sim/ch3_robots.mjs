// 通道 3 · 第二格前置：得间 / 书旗 / 塔读 三家的 robots 判定。
// 派单要求「先查 robots 再决定抓哪家」，本脚本只取 robots.txt 与首页连通性，不采任何书目。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 仓库路径带中文，import.meta.url 是 percent-encoded 的，必须经 fileURLToPath 还原后再拼路径。
const DIR = fileURLToPath(new URL(".", import.meta.url));
const OUT = path.join(DIR, "raw");
fs.mkdirSync(OUT, { recursive: true });

const AI_BOTS = ["claudebot", "chatgpt-user", "gptbot", "anthropic", "ccbot", "perplexity"];

const sites = [
  ["dejian", "得间小说", "https://www.idejian.com"],
  ["shuqi", "书旗小说", "https://www.shuqi.com"],
  ["tadu", "塔读文学", "https://www.tadu.com"],
];

// robots.txt 按 User-agent 段切开，返回 { agent: [rule lines] }
function parseRobots(txt) {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    // 书旗的 robots.txt 第 2-6 行用的是全角冒号（Disallow：/about/）。全角冒号不是合法 robots 语法，
    // 严格解析器会整行忽略，但站方意图明确，这里归一成半角后照常生效，不钻这个格式空子。
    const line = raw.replace(/#.*$/, "").replace(/\uFF1A/g, ":").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, val] = [m[0], m[1].toLowerCase(), m[2].trim()];
    if (key === "user-agent") {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
    } else if (cur && key !== "sitemap") {
      cur.rules.push(`${key}: ${val}`);
    } else if (key === "sitemap") {
      sitemaps.push(val);
    }
  }
  return { groups, sitemaps };
}

const verdicts = [];

for (const [key, cn, origin] of sites) {
  const url = `${origin}/robots.txt`;
  const v = { key, cn, origin, robotsUrl: url };
  try {
    const txt = await get(url, 1);
    fs.writeFileSync(path.join(OUT, `ch3_robots_${key}.txt`), txt, "utf8");
    v.httpStatus = 200;
    v.bytes = txt.length;
    v.challenged = txt.includes("probe.js") || txt.includes("var buid");

    const { groups, sitemaps } = parseRobots(txt);
    v.agents = [...new Set(groups.flatMap((g) => g.agents))];
    v.sitemapCount = sitemaps.length;
    v.sitemapSample = sitemaps.slice(0, 2);
    v.aiBotBans = [];
    v.starRules = [];
    for (const g of groups) {
      for (const a of g.agents) {
        if (AI_BOTS.some((b) => a.includes(b))) {
          v.aiBotBans.push({ agent: a, rules: g.rules });
        }
        if (a === "*") v.starRules.push(...g.rules);
      }
    }
    const starBlanket = v.starRules.some((r) => /^disallow:\s*\/$/.test(r));
    v.verdict = v.challenged
      ? "BLOCKED (robots.txt 被反爬挑战页替换，不可读→从严视为不允许)"
      : v.aiBotBans.length
        ? "BLOCKED (robots 点名禁止 AI 代理)"
        : starBlanket
          ? "BLOCKED (对 * 整站 Disallow: /)"
          : "OPEN (对 * 未整站禁止，逐路径核对后可抓)";
  } catch (e) {
    v.httpStatus = e.status ?? null;
    v.error = e.message;
    // robots.txt 返回 404 = 站方未设限，按惯例视为允许；其余不可达从严视为不允许。
    v.verdict =
      e.status === 404
        ? "OPEN (无 robots.txt，按惯例视为允许)"
        : `BLOCKED (robots 不可达: ${e.status ?? e.message}，从严)`;
  }
  verdicts.push(v);
  console.log(`\n=== ${cn} ${origin} ===`);
  console.log(`  ${v.verdict}`);
  if (v.agents) console.log(`  声明的 User-agent 段: ${v.agents.join(", ") || "(无)"}`);
  if (v.aiBotBans?.length)
    for (const b of v.aiBotBans) console.log(`  [AI-BOT 禁令] ${b.agent} -> ${b.rules.join(" | ")}`);
  if (v.starRules?.length) console.log(`  对 * 的规则: ${v.starRules.join(" | ")}`);
  if (v.sitemapCount) console.log(`  sitemap: ${v.sitemapCount} 条，例 ${v.sitemapSample[0]}`);
  await sleep(1200);
}

fs.writeFileSync(
  path.join(DIR, "ch3_robots_verdict.json"),
  JSON.stringify(verdicts, null, 2),
  "utf8",
);
console.log("\n--- 汇总 ---");
for (const v of verdicts) console.log(`${v.cn}: ${v.verdict}`);
