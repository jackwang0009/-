// 归档器：只处理公开元数据、官方书页链接与封面图。
// 合规红线：本脚本不得包含任何抓取章节正文/目录正文的逻辑。

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');

const CANONICAL_COLUMNS = [
  '序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
  '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826',
  '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态',
];

// 底本 CSV 用的是旧列名，只在对应正式列缺席时才启用，并记入 manifest.aliasesApplied
const COLUMN_ALIASES = {
  '榜位快照': '榜位快照20260826',
  '核心设定/开篇套路': '核心设定',
  '核心玄幻盘': '是否核心玄幻盘',
  '题材': '平台分类',
  '字数': '字数(万)',
  '书页URL': '官方书页URL',
  '封面': '封面URL',
};

const MASTER_CSV = 'docs/书库/玄幻书库-100本.csv';
const BASELINE_CSV = 'docs/玄幻选题库-100本-20260826.csv';
const INPUT_CANDIDATES = [MASTER_CSV, BASELINE_CSV];

function parseArgs(argv) {
  const opts = {
    input: null,
    outDir: path.join(ROOT, '书库归档'),
    covers: true,
    delayMs: 1200,
    backoffMs: 60000,
    timeoutMs: 20000,
    limit: 0,
    force: false,
    minBytes: 10240,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--in') opts.input = path.resolve(ROOT, next());
    else if (a === '--out') opts.outDir = path.resolve(ROOT, next());
    else if (a === '--no-covers') opts.covers = false;
    else if (a === '--delay') opts.delayMs = Number(next());
    else if (a === '--backoff') opts.backoffMs = Number(next());
    else if (a === '--timeout') opts.timeoutMs = Number(next());
    else if (a === '--limit') opts.limit = Number(next());
    else if (a === '--force') opts.force = true;
    else if (a === '--min-bytes') opts.minBytes = Number(next());
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else throw new Error(`未知参数：${a}`);
  }
  if (!Number.isFinite(opts.delayMs) || opts.delayMs < 1000) opts.delayMs = 1000;
  return opts;
}

function printHelp() {
  console.log(`用法: node .scrape/archive.mjs [选项]

  --in <csv>      输入总表，默认依次尝试:
                  ${INPUT_CANDIDATES.join('\n                  ')}
  --out <dir>     输出目录，默认 书库归档/
  --no-covers     只生成 JSON/manifest/index.html，不下载封面
  --delay <ms>    封面请求间隔，最低 1000，默认 1200
  --backoff <ms>  遇 403/429 的退避时长，默认 60000
  --timeout <ms>  单张图超时，默认 20000
  --limit <n>     只处理前 n 条（偷跑用）
  --force         已存在的封面也重新下载
  --min-bytes <n> 小于此体积视为占位图/拦截页，默认 10240
`);
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let dirty = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; dirty = true; }
    else if (c === ',') { row.push(field); field = ''; dirty = true; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; dirty = false; }
    else if (c !== '\r') { field += c; dirty = true; }
  }
  if (dirty || field.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function buildRecords(rows) {
  if (!rows.length) return { records: [], header: [], aliasesApplied: {} };
  const header = rows[0].map((h) => h.trim());
  const aliasesApplied = {};
  const records = rows.slice(1).map((cells) => {
    const raw = {};
    header.forEach((key, idx) => { raw[key] = (cells[idx] ?? '').trim(); });
    const rec = {};
    for (const col of CANONICAL_COLUMNS) rec[col] = raw[col] ?? '';
    for (const [from, to] of Object.entries(COLUMN_ALIASES)) {
      if (!header.includes(to) && header.includes(from) && !rec[to]) {
        rec[to] = raw[from] ?? '';
        aliasesApplied[from] = to;
      }
    }
    const extras = {};
    for (const key of header) {
      if (!CANONICAL_COLUMNS.includes(key) && !(key in COLUMN_ALIASES)) extras[key] = raw[key];
    }
    if (Object.keys(extras).length) rec.__extras = extras;
    return rec;
  });
  return { records, header, aliasesApplied };
}

function safeFileName(s) {
  return String(s)
    .replace(/[\uE000-\uF8FF]/g, '_')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 60) || 'untitled';
}

function extFromContentType(ct) {
  if (!ct) return null;
  const v = ct.toLowerCase();
  if (v.includes('jpeg') || v.includes('jpg')) return '.jpg';
  if (v.includes('png')) return '.png';
  if (v.includes('webp')) return '.webp';
  if (v.includes('gif')) return '.gif';
  if (v.includes('avif')) return '.avif';
  if (v.includes('image/')) return '.jpg';
  return null;
}

function extFromUrl(u) {
  const m = /\.(jpg|jpeg|png|webp|gif|avif)(?:$|[?#])/i.exec(u);
  if (!m) return null;
  return m[1].toLowerCase() === 'jpeg' ? '.jpg' : `.${m[1].toLowerCase()}`;
}

// 已观测到的最大一张占位图（起点 CDN 对不存在 bookId 返回 200 + image/jpeg）。
// 任何平台的体积下限都不得低于它：哈希查重只能抓「多本共用同一张」，
// 单本单张的占位图没有第二张可比，此时体积下限是唯一岗哨。调阈值前先看这个数。
const KNOWN_PLACEHOLDER_BYTES = 6909;

// 各平台封面体积差一个数量级，全局阈值必然要么误杀要么放水。
// 两类值可信度不同，别混着看：
//   有反例支撑 —— 起点/QQ阅读 15000：真封面 min 21710，且确实拦得住那张 6909 的占位图。
//   仅启发式   —— 番茄 8000（真封面 min 11488）、七猫/纵横 15000（min 28708）：
//                 本轮未观测到这两家 CDN 的占位图，取值只是「小到不可能是真图」，未经反例验证。
const PLATFORM_MIN_BYTES = {
  番茄: 8000,
  起点: 15000,
  QQ阅读: 15000,
  七猫: 15000,
  纵横: 15000,
};

for (const [p, v] of Object.entries(PLATFORM_MIN_BYTES)) {
  if (v <= KNOWN_PLACEHOLDER_BYTES) {
    throw new Error(`${p} 的体积下限 ${v} 不高于已知占位图 ${KNOWN_PLACEHOLDER_BYTES} 字节，会放过占位图`);
  }
}

function minBytesFor(platform, fallback) {
  return PLATFORM_MIN_BYTES[platform] ?? fallback;
}

// 番茄 thumbUrl 的签名链有等效免签名形式：主机归一到 p6-novel、丢掉整个 query。
// p9-novel 无免签名对应会 403，所以必须归一而不是只去掉 -sign。路径尾部 ~tplv-resize 是尺寸参数要保留。
function permanentUrl(url) {
  try {
    const u = new URL(url);
    if (!/^p\d+-novel(-sign)?\.byteimg\.com$/i.test(u.hostname)) return url;
    return `${u.protocol}//p6-novel.byteimg.com${u.pathname}`;
  } catch { return url; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 番茄 thumbUrl 是带 x-expires/x-signature 的签名链，约 24 小时失效。
// 过期后返回 403 + text/html，属链接时效问题而非数据质量问题，重取签名才有用，退避重试无意义。
function signedExpiry(url) {
  const m = /[?&]x-expires=([^&]+)/i.exec(url);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  const secs = Number(raw);
  if (Number.isFinite(secs) && secs > 1e9) return new Date(secs * 1000).toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

let lastRequestAt = 0;
// 循环校验而非单次 sleep：setTimeout 在 Windows 上会提前若干毫秒触发，单次等待会让实际间隔跌破 1 秒红线
async function throttle(delayMs) {
  for (;;) {
    const wait = lastRequestAt + delayMs - Date.now();
    if (wait <= 0) break;
    await sleep(wait);
  }
  lastRequestAt = Date.now();
}

function findExistingCover(coversDir, seq) {
  let entries;
  try { entries = fsSync.readdirSync(coversDir); } catch { return null; }
  const prefix = `${seq}-`;
  return entries.find((f) => f.startsWith(prefix)) ?? null;
}

async function fetchImage(url, timeoutMs) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
    },
  });
  return res;
}

async function downloadCover(rec, coversDir, opts) {
  const seq = rec['序号'];
  const raw = (rec['封面URL'] || '').trim();
  if (!raw) return { status: 'no-url' };
  if (!/^https?:\/\//i.test(raw)) return { status: 'failed', reason: `封面URL 不是 http(s) 链接：${raw.slice(0, 80)}` };
  const url = permanentUrl(raw);
  const minBytes = minBytesFor(rec['平台'], opts.minBytes);

  const existing = opts.force ? null : findExistingCover(coversDir, seq);
  if (existing) return { status: 'skipped', file: existing };

  const base = `${seq}-${safeFileName(rec['书名'] || 'untitled')}`;
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      await throttle(opts.delayMs);
      const res = await fetchImage(url, opts.timeoutMs);
      const expiry = signedExpiry(url);
      if (res.status === 403 && expiry) {
        return {
          status: 'failed', expired: true,
          reason: `HTTP 403 签名已过期（x-expires=${expiry}），需回官方书页重取 thumbUrl —— 属链接时效问题，不是数据质量问题`,
        };
      }
      if (res.status === 403 || res.status === 429) {
        if (attempt < 2) {
          console.log(`    ${res.status}，退避 ${Math.round(opts.backoffMs / 1000)}s 后重试一次`);
          await sleep(opts.backoffMs);
          continue;
        }
        return { status: 'failed', reason: `HTTP ${res.status}（退避重试后仍被拒）` };
      }
      if (!res.ok) return { status: 'failed', reason: `HTTP ${res.status}` };

      const ct = res.headers.get('content-type') || '';
      if (ct && !ct.toLowerCase().includes('image/')) {
        return { status: 'failed', reason: `响应不是图片（content-type: ${ct.slice(0, 60)}）` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // 番茄的软限流是 HTTP 200 + 空 body，不是 403/429。按普通失败快速重试既拉不到图也看不出原因，
      // 必须和限流一样退避。
      if (buf.length === 0) {
        if (attempt < 2) {
          console.log(`    200 但 body 为空（疑似软限流），退避 ${Math.round(opts.backoffMs / 1000)}s 后重试一次`);
          await sleep(opts.backoffMs);
          continue;
        }
        return { status: 'failed', throttled: true, reason: 'HTTP 200 但 body 为空 —— 平台软限流，退避重试后仍为空，建议降速后重跑' };
      }
      // 平台 CDN 对不存在的 bookId 会回 200 + 图片类型的占位图（实测起点回 6.9KB 的 jpeg），
      // 只看状态码和 content-type 会把这类假成功当真
      if (buf.length < minBytes) {
        return { status: 'failed', reason: `图片仅 ${buf.length} 字节，低于${rec['平台'] ? ` ${rec['平台']} 的` : ''} ${minBytes} 下限，疑似占位图或拦截页（bookId 可能不存在）` };
      }

      const ext = extFromContentType(ct) || extFromUrl(url) || '.jpg';
      const file = `${base}${ext}`;
      await fs.writeFile(path.join(coversDir, file), buf);
      return {
        status: 'ok', file, bytes: buf.length, contentType: ct.split(';')[0].trim(),
        sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        归一化免签名: url !== raw ? url : null,
      };
    } catch (err) {
      const reason = err?.name === 'TimeoutError' ? `超时 ${opts.timeoutMs}ms` : (err?.message || String(err));
      if (attempt < 2 && /fetch failed|ECONNRESET|socket hang up/i.test(reason)) {
        await sleep(2000);
        continue;
      }
      return { status: 'failed', reason };
    }
  }
  return { status: 'failed', reason: '重试次数用尽' };
}

function toBook(rec, coverFile) {
  const num = (v) => {
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
  };
  return {
    序号: num(rec['序号']),
    书名: rec['书名'],
    作者: rec['作者'],
    平台: rec['平台'],
    书籍ID: rec['书籍ID'],
    官方书页URL: rec['官方书页URL'],
    '字数(万)': num(rec['字数(万)']),
    连载状态: rec['连载状态'],
    平台分类: rec['平台分类'],
    内容标签: rec['内容标签'] ? rec['内容标签'].split('/').map((s) => s.trim()).filter(Boolean) : [],
    总章节数: num(rec['总章节数']),
    首发时间: rec['首发时间'],
    最近更新: rec['最近更新'],
    榜位快照20260826: rec['榜位快照20260826'],
    核心设定: rec['核心设定'],
    简介摘要: rec['简介摘要'],
    封面URL: rec['封面URL'],
    是否核心玄幻盘: rec['是否核心玄幻盘'],
    数据来源: rec['数据来源'],
    核验状态: rec['核验状态'],
    封面文件: coverFile ? `covers/${coverFile}` : null,
    含PUA字符: /[\uE000-\uF8FF]/.test(`${rec['书名']}${rec['作者']}`),
    ...(rec.__extras ? { 其它列: rec.__extras } : {}),
  };
}

function coverage(records) {
  const out = {};
  for (const col of CANONICAL_COLUMNS) {
    const filled = records.filter((r) => (r[col] ?? '').trim() !== '').length;
    out[col] = {
      非空: filled,
      总数: records.length,
      覆盖率: records.length ? `${((filled / records.length) * 100).toFixed(1)}%` : '0.0%',
    };
  }
  return out;
}

function tally(records, col) {
  const map = {};
  for (const r of records) {
    const key = (r[col] || '').trim() || '(空)';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]));
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderIndexHtml(books, manifest) {
  const payload = JSON.stringify({ books, manifest })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>玄幻书库 · 离线索引（${escHtml(manifest.快照日期)}）</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --panel2: #1e222b; --line: #2a2f3a;
    --fg: #e6e8ec; --dim: #949aa6; --accent: #f0a24b; --ok: #4fb477; --warn: #d9944a; --bad: #d1565b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 10; background: rgba(15,17,21,.94);
    backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); padding: 14px 20px 12px; }
  h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: .5px; }
  h1 span { color: var(--accent); }
  .meta { color: var(--dim); font-size: 12px; margin-bottom: 10px; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  input[type="search"], select {
    background: var(--panel2); color: var(--fg); border: 1px solid var(--line);
    border-radius: 6px; padding: 7px 10px; font-size: 13px; font-family: inherit; outline: none; }
  input[type="search"] { min-width: 260px; flex: 1 1 260px; }
  input[type="search"]:focus, select:focus { border-color: var(--accent); }
  .count { color: var(--dim); font-size: 12px; margin-left: auto; white-space: nowrap; }
  main { padding: 18px 20px 60px; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    overflow: hidden; display: flex; flex-direction: column; }
  .card:hover { border-color: #3b4250; }
  .cover { position: relative; aspect-ratio: 3 / 4; background: var(--panel2); overflow: hidden; }
  .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-size: 34px; color: #4b5364; background: linear-gradient(140deg, #232833, #171a21); }
  .seq { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.66); color: #fff;
    font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  .plat { position: absolute; top: 6px; right: 6px; background: rgba(240,162,75,.9); color: #1a1200;
    font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .body { padding: 9px 10px 11px; display: flex; flex-direction: column; gap: 5px; }
  .title { font-size: 14px; font-weight: 600; line-height: 1.35; }
  .title a { color: var(--fg); text-decoration: none; }
  .title a:hover { color: var(--accent); text-decoration: underline; }
  .title .nolink { color: var(--dim); }
  .sub { font-size: 12px; color: var(--dim); }
  .desc { font-size: 12px; color: #b7bdc8; line-height: 1.5;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
  .tag { font-size: 11px; color: var(--dim); background: var(--panel2);
    border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
  .vs { font-size: 11px; padding: 1px 5px; border-radius: 4px; }
  .vs-ok { color: var(--ok); border: 1px solid rgba(79,180,119,.4); }
  .vs-wait { color: var(--warn); border: 1px solid rgba(217,148,74,.4); }
  .vs-bad { color: var(--bad); border: 1px solid rgba(209,86,91,.4); }
  .empty { color: var(--dim); text-align: center; padding: 60px 0; font-size: 14px; }
  footer { color: var(--dim); font-size: 12px; padding: 0 20px 30px; line-height: 1.7; }
</style>
</head>
<body>
<header>
  <h1>玄幻书库 · <span>离线索引</span></h1>
  <div class="meta">快照 ${escHtml(manifest.快照日期)} · 共 ${manifest.总数} 本 · 封面 ${manifest.封面.成功 + manifest.封面.已存在跳过} 张 · 本库只存公开元数据与官方链接，不存作品正文</div>
  <div class="controls">
    <input type="search" id="q" placeholder="搜索书名 / 作者 / 标签 / 设定…" autocomplete="off">
    <select id="platform"><option value="">全部平台</option></select>
    <select id="category"><option value="">全部分类</option></select>
    <select id="verify"><option value="">全部核验状态</option></select>
    <select id="sort">
      <option value="seq">按序号</option>
      <option value="words">按字数</option>
      <option value="title">按书名</option>
    </select>
    <span class="count" id="count"></span>
  </div>
</header>
<main><div class="grid" id="grid"></div><div class="empty" id="empty" hidden>没有匹配的书目</div></main>
<footer>
  合规说明：本页仅收录各平台公开展示的元数据、官方书页链接与封面图，不含任何章节正文。点击书名跳转平台官方书页，阅读请走正版。
</footer>
<script type="application/json" id="data">${payload}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('data').textContent);
  var books = DATA.books;
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var countEl = document.getElementById('count');
  var q = document.getElementById('q');
  var selPlatform = document.getElementById('platform');
  var selCategory = document.getElementById('category');
  var selVerify = document.getElementById('verify');
  var selSort = document.getElementById('sort');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }

  function uniq(key) {
    var seen = {};
    books.forEach(function (b) {
      var v = (b[key] || '').trim();
      if (v) seen[v] = (seen[v] || 0) + 1;
    });
    return Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; });
  }

  fillSelect(selPlatform, uniq('平台'));
  fillSelect(selCategory, uniq('平台分类'));
  fillSelect(selVerify, uniq('核验状态'));

  books.forEach(function (b) {
    b._hay = [b.书名, b.作者, b.平台, b.平台分类, b.核心设定, b.简介摘要, b.榜位快照20260826,
      (b.内容标签 || []).join(' '), b.书籍ID].join(' ').toLowerCase();
  });

  function verifyClass(v) {
    if (!v) return '';
    if (v.indexOf('已核实') === 0) return 'vs-ok';
    if (v.indexOf('冲突') === 0) return 'vs-bad';
    return 'vs-wait';
  }

  function card(b) {
    var cover = b.封面文件
      ? '<img loading="lazy" src="' + esc(b.封面文件) + '" alt="' + esc(b.书名) + ' 封面">'
      : '<div class="ph">' + esc((b.书名 || '?').slice(0, 1)) + '</div>';
    var title = b.官方书页URL
      ? '<a href="' + esc(b.官方书页URL) + '" target="_blank" rel="noopener noreferrer">' + esc(b.书名) + '</a>'
      : '<span class="nolink" title="缺官方书页URL">' + esc(b.书名) + '</span>';
    var bits = [];
    if (b.作者) bits.push(esc(b.作者));
    if (b['字数(万)'] != null) bits.push(esc(b['字数(万)']) + ' 万字');
    if (b.连载状态) bits.push(esc(b.连载状态));
    var tags = [];
    if (b.平台分类) tags.push('<span class="tag">' + esc(b.平台分类) + '</span>');
    (b.内容标签 || []).slice(0, 3).forEach(function (t) {
      tags.push('<span class="tag">' + esc(t) + '</span>');
    });
    if (b.核验状态) {
      tags.push('<span class="vs ' + verifyClass(b.核验状态) + '">' + esc(b.核验状态) + '</span>');
    }
    if (b.含PUA字符) tags.push('<span class="vs vs-bad">PUA字形</span>');
    var desc = b.简介摘要 || b.核心设定 || '';

    var el = document.createElement('div');
    el.className = 'card';
    el.innerHTML =
      '<div class="cover">' + cover +
        '<span class="seq">' + esc(b.序号) + '</span>' +
        (b.平台 ? '<span class="plat">' + esc(b.平台) + '</span>' : '') +
      '</div>' +
      '<div class="body">' +
        '<div class="title">' + title + '</div>' +
        (bits.length ? '<div class="sub">' + bits.join(' · ') + '</div>' : '') +
        (desc ? '<div class="desc">' + esc(desc) + '</div>' : '') +
        (tags.length ? '<div class="tags">' + tags.join('') + '</div>' : '') +
      '</div>';
    return el;
  }

  function render() {
    var kw = q.value.trim().toLowerCase();
    var p = selPlatform.value, c = selCategory.value, v = selVerify.value, s = selSort.value;
    var list = books.filter(function (b) {
      if (p && (b.平台 || '') !== p) return false;
      if (c && (b.平台分类 || '') !== c) return false;
      if (v && (b.核验状态 || '') !== v) return false;
      if (kw && b._hay.indexOf(kw) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (s === 'words') return (b['字数(万)'] || 0) - (a['字数(万)'] || 0);
      if (s === 'title') return String(a.书名).localeCompare(String(b.书名), 'zh');
      return (a.序号 || 0) - (b.序号 || 0);
    });
    grid.replaceChildren.apply(grid, list.map(card));
    empty.hidden = list.length > 0;
    countEl.textContent = list.length + ' / ' + books.length + ' 本';
  }

  [q, selPlatform, selCategory, selVerify, selSort].forEach(function (el) {
    el.addEventListener('input', render);
  });
  render();
})();
</script>
</body>
</html>
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let input = opts.input;
  if (!input) {
    for (const cand of INPUT_CANDIDATES) {
      const p = path.join(ROOT, cand);
      if (fsSync.existsSync(p)) { input = p; break; }
    }
  }
  if (!input || !fsSync.existsSync(input)) throw new Error(`找不到输入 CSV：${input ?? INPUT_CANDIDATES.join(' / ')}`);

  const isBaseline = path.resolve(input) === path.join(ROOT, BASELINE_CSV);

  const text = await fs.readFile(input, 'utf8');
  const { records: allRecords, header, aliasesApplied } = buildRecords(parseCsv(text));
  const headerCompliant = header.length === CANONICAL_COLUMNS.length
    && header.every((h, i) => h === CANONICAL_COLUMNS[i]);
  console.log(`输入：${path.relative(ROOT, input)}${isBaseline ? '（底本，非合并总表）' : ''}${headerCompliant ? '' : '（表头不合 20 列规范）'}`);
  const records = opts.limit > 0 ? allRecords.slice(0, opts.limit) : allRecords;
  console.log(`读到 ${allRecords.length} 条，本次处理 ${records.length} 条`);
  if (Object.keys(aliasesApplied).length) {
    console.log(`列名兼容映射：${Object.entries(aliasesApplied).map(([a, b]) => `${a}→${b}`).join('、')}`);
  }

  const booksDir = path.join(opts.outDir, 'books');
  const coversDir = path.join(opts.outDir, 'covers');
  await fs.mkdir(booksDir, { recursive: true });
  await fs.mkdir(coversDir, { recursive: true });

  const stats = { ok: 0, skipped: 0, failed: 0, noUrl: 0, expired: 0, throttled: 0 };
  const failures = [];
  const books = [];
  const coverDetail = [];
  const hashOf = (file) => {
    try { return crypto.createHash('sha256').update(fsSync.readFileSync(path.join(coversDir, file))).digest('hex'); }
    catch { return null; }
  };

  for (const rec of records) {
    let coverFile = null;
    if (opts.covers) {
      const r = await downloadCover(rec, coversDir, opts);
      if (r.status === 'ok') {
        stats.ok++; coverFile = r.file;
        coverDetail.push({
          序号: rec['序号'], 书名: rec['书名'], 文件: r.file, 字节: r.bytes,
          类型: r.contentType, sha256: r.sha256,
          ...(r.归一化免签名 ? { 实际请求: r.归一化免签名 } : {}),
        });
        console.log(`  [封面] ${rec['序号']} ${rec['书名']} ← ${(r.bytes / 1024).toFixed(0)}KB`);
      } else if (r.status === 'skipped') {
        stats.skipped++; coverFile = r.file;
        const h = hashOf(r.file);
        if (h) coverDetail.push({ 序号: rec['序号'], 书名: rec['书名'], 文件: r.file, 字节: fsSync.statSync(path.join(coversDir, r.file)).size, 类型: '(已存在)', sha256: h });
      } else if (r.status === 'no-url') stats.noUrl++;
      else {
        stats.failed++;
        if (r.expired) stats.expired++;
        if (r.throttled) stats.throttled++;
        failures.push({
          序号: rec['序号'], 书名: rec['书名'], 封面URL: rec['封面URL'], 原因: r.reason,
          签名过期: !!r.expired, 疑似限流: !!r.throttled,
        });
        const tag = r.expired ? '签名过期' : r.throttled ? '疑似限流' : '失败';
        console.log(`  [${tag}] ${rec['序号']} ${rec['书名']} — ${r.reason}`);
      }
    } else {
      const existing = findExistingCover(coversDir, rec['序号']);
      if (existing) { stats.skipped++; coverFile = existing; }
      else if ((rec['封面URL'] || '').trim()) stats.failed++;
      else stats.noUrl++;
    }

    const book = toBook(rec, coverFile);
    books.push(book);
    await fs.writeFile(
      path.join(booksDir, `${rec['序号'] || 'unknown'}.json`),
      JSON.stringify(book, null, 2) + '\n',
      'utf8',
    );
  }

  const manifest = {
    生成时间: new Date().toISOString(),
    快照日期: '2026-08-26',
    输入表: path.relative(ROOT, input).replace(/\\/g, '/'),
    输入表是底本: isBaseline,
    表头合规: headerCompliant,
    总数: books.length,
    输入表原始列: header,
    列名兼容映射: aliasesApplied,
    字段覆盖率: coverage(records),
    平台分布: tally(records, '平台'),
    分类分布: tally(records, '平台分类'),
    核验状态分布: tally(records, '核验状态'),
    含PUA字符条目: books.filter((b) => b.含PUA字符).map((b) => ({ 序号: b.序号, 书名: b.书名 })),
    封面: {
      本次下载: stats.ok,
      成功: stats.ok,
      已存在跳过: stats.skipped,
      失败: stats.failed,
      其中签名过期: stats.expired,
      其中疑似限流: stats.throttled,
      无封面URL: stats.noUrl,
      下载开关: opts.covers,
    },
    封面链接时效性: (() => {
      const signed = records
        .map((r) => ({ 序号: r['序号'], 平台: r['平台'], 到期: signedExpiry(r['封面URL'] || '') }))
        .filter((x) => x.到期);
      if (!signed.length) return { 存在签名链: false };
      const times = signed.map((s) => s.到期).sort();
      return {
        存在签名链: true,
        条目数: signed.length,
        最早到期: times[0],
        最晚到期: times[times.length - 1],
        说明: '这些封面URL带 x-expires/x-signature，过期后返回 403 + text/html。'
          + 'CSV 里的该列过期即不可直接复用，但已落盘的图片文件不受影响。'
          + '需要重下时应回官方书页重取新签名的 thumbUrl，而不是重试旧链接。',
        涉及平台: [...new Set(signed.map((s) => s.平台).filter(Boolean))],
      };
    })(),
    封面失败明细: failures,
    疑似占位图: (() => {
      const byHash = {};
      for (const d of coverDetail) (byHash[d.sha256] ||= []).push(d);
      return Object.values(byHash).filter((g) => g.length > 1).map((g) => ({
        说明: '多本共用同一张图，几乎必为平台占位图，对应 bookId 很可能不存在',
        字节: g[0].字节,
        条目: g.map((d) => `#${d.序号} ${d.书名}`),
      }));
    })(),
    封面明细: coverDetail,
    合规声明: '本归档只包含公开元数据、官方书页链接与封面图，不含任何章节正文。',
  };

  await fs.writeFile(path.join(opts.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(opts.outDir, 'index.html'), renderIndexHtml(books, manifest), 'utf8');

  console.log('\n--- 归档完成 ---');
  console.log(`books/    ${books.length} 份 JSON`);
  console.log(`covers/   成功 ${stats.ok} · 已存在 ${stats.skipped} · 失败 ${stats.failed} · 无URL ${stats.noUrl}`);
  console.log(`输出目录  ${path.relative(ROOT, opts.outDir)}/`);
  for (const g of manifest.疑似占位图) {
    console.log(`[疑似占位图] ${g.条目.join('、')} 共用同一张 ${(g.字节 / 1024).toFixed(1)}KB 的图，bookId 可能不存在`);
  }
  const missing = CANONICAL_COLUMNS.filter((c) => manifest.字段覆盖率[c].非空 === 0);
  if (missing.length) console.log(`全空列（${missing.length}）：${missing.join('、')}`);
}

main().catch((err) => {
  console.error('归档失败：', err);
  process.exitCode = 1;
});
