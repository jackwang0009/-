// archive.mjs 封面下载路径的自测：起本地图床，覆盖成功/404/非图片/超小图/可重入/限速。
// 不涉及任何真实站点，也不抓取任何正文。

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, '.scrape', '_selftest');
const OUT = path.join(TMP, 'out');
const CSV = path.join(TMP, 'test.csv');

// 最小合法 PNG 加填充，撑过 10240 字节下限；fill 不同则哈希不同，用来区分「真图」与「共用占位图」
function makePng(fill, size = 20480) {
  const head = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  return Buffer.concat([head, Buffer.alloc(size - head.length, fill)]);
}

const PNG_A = makePng(0x20);
const PNG_B = makePng(0x41);
// 仿起点 CDN 对不存在 bookId 的响应：200 + image/jpeg 但只有 6909 字节的占位图
const PNG_FAKE = makePng(0x20, 6909);
const hits = [];

const server = http.createServer((req, res) => {
  hits.push({ url: req.url, at: Date.now() });
  if (req.url === '/ok.jpg') {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(PNG_A);
  } else if (req.url === '/ok-noext') {
    res.writeHead(200, { 'content-type': 'image/webp' });
    res.end(PNG_B);
  } else if (req.url === '/fake.jpg') {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(PNG_FAKE);
  } else if (req.url === '/missing.jpg') {
    res.writeHead(404); res.end('nope');
  } else if (req.url === '/html.jpg') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html>anti-crawl</html>');
  } else if (req.url === '/tiny.jpg') {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(Buffer.alloc(10));
  } else if (req.url === '/rate.jpg') {
    res.writeHead(429); res.end('slow down');
  } else if (req.url.startsWith('/signed.jpg')) {
    res.writeHead(403, { 'content-type': 'text/html' }); res.end('<html>expired</html>');
  } else if (req.url === '/empty.jpg') {
    // 番茄软限流的形态：状态码正常、类型正常，就是没有 body
    res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end();
  } else {
    res.writeHead(500); res.end();
  }
});

function csvFor(base) {
  const rows = [
    ['序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态', '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826', '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态'],
    ['1', '正常封面', '甲', '番茄', 'b1', 'https://example.com/1', '12.5', '连载中', '传统玄幻', 'a/b', '300', '2025-01-01', '2026-08-20', '榜 #1', '设定一', '摘要一', `${base}/ok.jpg`, '是', '自测', '已核实'],
    ['2', '无扩展名/webp', '乙', '起点', 'b2', 'https://example.com/2', '30', '已完结', '东方玄幻', '', '', '', '', '榜 #2', '设定二', '摘要二', `${base}/ok-noext`, '是', '自测', '已核实'],
    ['3', '404 图', '丙', '七猫', 'b3', 'https://example.com/3', '8', '连载中', '玄幻', '', '', '', '', '榜 #3', '设定三', '', `${base}/missing.jpg`, '否', '自测', '待核实'],
    ['4', '返回 HTML 的图', '丁', '纵横', 'b4', 'https://example.com/4', '', '连载中', '玄幻', '', '', '', '', '榜 #4', '设定四', '', `${base}/html.jpg`, '否', '自测', '待核实'],
    ['5', '过小的图', '戊', 'QQ阅读', 'b5', 'https://example.com/5', '', '连载中', '玄幻', '', '', '', '', '榜 #5', '设定五', '', `${base}/tiny.jpg`, '否', '自测', '待核实'],
    ['6', '没有封面URL', '己', '番茄', 'b6', '', '', '连载中', '玄幻', '', '', '', '', '榜 #6', '设定六', '', '', '否', '自测', '待核实'],
    ['7', '非法链接 ftp://x', '庚', '番茄', 'b7', '', '', '连载中', '玄幻', '', '', '', '', '榜 #7', '设定七', '', 'ftp://x/y.jpg', '否', '自测', '待核实'],
    ['8', '书名带:非法*字符?', '辛', '番茄', 'b8', 'https://example.com/8', '', '连载中', '玄幻', '', '', '', '', '榜 #8', '设定八', '', `${base}/ok.jpg`, '否', '自测', '待核实'],
    ['9', '假成功占位图', '壬', '起点', 'b9', 'https://example.com/9', '', '连载中', '玄幻', '', '', '', '', '榜 #9', '设定九', '', `${base}/fake.jpg`, '否', '自测', '待核实'],
  ];
  return '\ufeff' + rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n') + '\r\n';
}

// 必须异步 spawn：本地图床跑在同一进程里，同步等待会锁死事件循环让服务器无法应答
function runArchive(extra = [], csv = CSV, out = OUT) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      path.join(ROOT, '.scrape', 'archive.mjs'),
      '--in', csv, '--out', out, ...extra,
    ], { cwd: ROOT });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('close', () => resolve(buf));
  });
}

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

await fs.rm(TMP, { recursive: true, force: true });
await fs.mkdir(TMP, { recursive: true });

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
await fs.writeFile(CSV, csvFor(base), 'utf8');

console.log('=== 第一跑（全新） ===');
const t0 = Date.now();
const out1 = await runArchive();
const elapsed1 = Date.now() - t0;
console.log(out1.trim());

const m1 = JSON.parse(await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8'));
const covers1 = fsSync.readdirSync(path.join(OUT, 'covers')).sort();

check('BOM + CRLF + 引号 CSV 解析出 9 条', m1.总数 === 9, `实得 ${m1.总数}`);
check('封面成功 3 张（含书名非法字符那本）', m1.封面.成功 === 3, `实得 ${m1.封面.成功}`);
check('封面失败 5 条（404/HTML/过小/非http/假成功占位图）', m1.封面.失败 === 5, `实得 ${m1.封面.失败}`);
check('无封面URL 1 条', m1.封面.无封面URL === 1, `实得 ${m1.封面.无封面URL}`);
check('假成功占位图被体积下限拦下（200+image/jpeg 但仅 6909 字节）',
  m1.封面失败明细.some((f) => f.序号 === '9' && /6909 字节/.test(f.原因)),
  m1.封面失败明细.find((f) => f.序号 === '9')?.原因);
check('疑似占位图查重：#1 与 #8 共用同一张图被揪出',
  m1.疑似占位图.length === 1 && m1.疑似占位图[0].条目.length === 2,
  JSON.stringify(m1.疑似占位图.map((g) => g.条目)));
check('content-type 决定扩展名 → 2-*.webp', covers1.some((f) => f.startsWith('2-') && f.endsWith('.webp')), covers1.join(', '));
check('书名非法字符已净化', covers1.some((f) => f.startsWith('8-') && !/[:*?]/.test(f)), covers1.filter((f) => f.startsWith('8-')).join(', '));
check('失败明细带原因', m1.封面失败明细.length === 5 && m1.封面失败明细.every((f) => f.原因), JSON.stringify(m1.封面失败明细.map((f) => `${f.序号}:${f.原因}`)));
check('单图失败不中断，9 份 JSON 全出', fsSync.readdirSync(path.join(OUT, 'books')).length === 9);
check('index.html 已生成且内嵌数据', fsSync.readFileSync(path.join(OUT, 'index.html'), 'utf8').includes('id="data"'));
check('index.html 不含未转义 </script> 破坏', (fsSync.readFileSync(path.join(OUT, 'index.html'), 'utf8').match(/<\/script>/g) || []).length === 2);

const imageHits = hits.filter((h) => h.url !== '/favicon.ico');
let minGap = Infinity;
for (let i = 1; i < imageHits.length; i++) minGap = Math.min(minGap, imageHits[i].at - imageHits[i - 1].at);
check('请求间隔 ≥ 1 秒（默认 1200ms 挡位，实测到达间隔）', minGap >= 1000, `最小间隔 ${minGap === Infinity ? 'n/a' : minGap + 'ms'}，总耗时 ${elapsed1}ms`);

console.log('\n=== 第二跑（可重入） ===');
const hitsBefore = hits.length;
const out2 = await runArchive();
console.log(out2.trim());
const m2 = JSON.parse(await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8'));
const reHits = hits.length - hitsBefore;
check('已存在封面被跳过（3 张）', m2.封面.已存在跳过 === 3, `实得 ${m2.封面.已存在跳过}`);
check('重入不重下已有封面，只重试 4 个失败项', reHits === 4, `实得 ${reHits} 次请求`);

const b1 = JSON.parse(await fs.readFile(path.join(OUT, 'books', '1.json'), 'utf8'));
check('book JSON 记录封面相对路径', typeof b1.封面文件 === 'string' && b1.封面文件.startsWith('covers/'), String(b1.封面文件));
check('内容标签拆成数组', Array.isArray(b1.内容标签) && b1.内容标签.length === 2, JSON.stringify(b1.内容标签));
check('字数转成数字', b1['字数(万)'] === 12.5, String(b1['字数(万)']));
check('20 列齐全时不触发别名映射', Object.keys(m2.列名兼容映射).length === 0, JSON.stringify(m2.列名兼容映射));
check('覆盖率统计正确（作者 9/9、内容标签 1/9）',
  m2.字段覆盖率['作者'].非空 === 9 && m2.字段覆盖率['内容标签'].非空 === 1,
  `作者 ${m2.字段覆盖率['作者'].覆盖率} / 内容标签 ${m2.字段覆盖率['内容标签'].覆盖率}`);

console.log('\n=== 第三跑（--no-covers 不发请求） ===');
const hitsBefore3 = hits.length;
await runArchive(['--no-covers']);
check('--no-covers 零网络请求', hits.length === hitsBefore3, `实得 ${hits.length - hitsBefore3} 次`);

console.log('\n=== 第四跑（429 退避重试，backoff 压到 1s） ===');
const CSV429 = path.join(TMP, 'rate.csv');
const OUT429 = path.join(TMP, 'out429');
await fs.writeFile(CSV429,
  '\ufeff序号,书名,封面URL\r\n1,限流书,' + base + '/rate.jpg\r\n', 'utf8');
const hitsBefore4 = hits.length;
const out4 = await runArchive(['--backoff', '1000'], CSV429, OUT429);
console.log(out4.trim());
const m4 = JSON.parse(await fs.readFile(path.join(OUT429, 'manifest.json'), 'utf8'));
const rateHits = hits.length - hitsBefore4;
check('429 触发退避后重试一次（共 2 次请求）', rateHits === 2, `实得 ${rateHits} 次`);
check('429 最终计入失败并说明原因',
  m4.封面.失败 === 1 && /429/.test(m4.封面失败明细[0]?.原因 || ''),
  m4.封面失败明细[0]?.原因);
check('缺列 CSV 不崩，仍出 manifest 与 index.html',
  m4.总数 === 1 && fsSync.existsSync(path.join(OUT429, 'index.html')));

console.log('\n=== 第五跑（签名链过期：403 + text/html） ===');
const CSVSIG = path.join(TMP, 'signed.csv');
const OUTSIG = path.join(TMP, 'outsig');
await fs.writeFile(CSVSIG,
  '\ufeff序号,书名,平台,封面URL\r\n1,签名过期书,番茄,'
  + base + '/signed.jpg?x-expires=1788000000&x-signature=abc\r\n', 'utf8');
const hitsBefore5 = hits.length;
const t5 = Date.now();
const out5 = await runArchive(['--backoff', '60000'], CSVSIG, OUTSIG);
const elapsed5 = Date.now() - t5;
console.log(out5.trim());
const m5 = JSON.parse(await fs.readFile(path.join(OUTSIG, 'manifest.json'), 'utf8'));
check('签名过期只请求 1 次，不做 60s 退避', hits.length - hitsBefore5 === 1 && elapsed5 < 30000,
  `${hits.length - hitsBefore5} 次请求，耗时 ${elapsed5}ms`);
check('签名过期单独计数而非混入普通失败', m5.封面.其中签名过期 === 1, `实得 ${m5.封面.其中签名过期}`);
check('失败原因点明是链接时效而非数据质量',
  /签名已过期/.test(m5.封面失败明细[0]?.原因 || '') && /不是数据质量问题/.test(m5.封面失败明细[0]?.原因 || ''),
  m5.封面失败明细[0]?.原因);
check('manifest 记录签名链到期时间', m5.封面链接时效性.存在签名链 === true && !!m5.封面链接时效性.最早到期,
  m5.封面链接时效性.最早到期);

console.log('\n=== 第六跑（软限流：200 + 空 body，backoff 压到 1s） ===');
const CSVEMPTY = path.join(TMP, 'empty.csv');
const OUTEMPTY = path.join(TMP, 'outempty');
await fs.writeFile(CSVEMPTY,
  '\ufeff序号,书名,平台,封面URL\r\n1,限流空响应,番茄,' + base + '/empty.jpg\r\n', 'utf8');
const hitsBefore6 = hits.length;
const out6 = await runArchive(['--backoff', '1000'], CSVEMPTY, OUTEMPTY);
console.log(out6.trim());
const m6 = JSON.parse(await fs.readFile(path.join(OUTEMPTY, 'manifest.json'), 'utf8'));
check('200 + 空 body 触发退避重试（共 2 次请求）', hits.length - hitsBefore6 === 2, `实得 ${hits.length - hitsBefore6} 次`);
check('空 body 归为疑似限流而非图片过小', m6.封面.其中疑似限流 === 1 && !/过小|下限/.test(m6.封面失败明细[0]?.原因 || ''),
  m6.封面失败明细[0]?.原因);

console.log('\n=== 阈值下界硬约束 ===');
const src = await fs.readFile(path.join(ROOT, '.scrape', 'archive.mjs'), 'utf8');
const known = Number(/KNOWN_PLACEHOLDER_BYTES = (\d+)/.exec(src)?.[1]);
const mins = [...src.matchAll(/^\s{2}(起点|QQ阅读|番茄|七猫|纵横): (\d+),/gm)].map((m) => [m[1], Number(m[2])]);
check('已知占位图体积已写成常量', known === 6909, String(known));
check('所有平台下限均高于已知占位图', mins.length === 5 && mins.every(([, v]) => v > known),
  mins.map(([k, v]) => `${k}=${v}`).join(' '));

server.close();
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 通过`);
if (failed.length) { console.log('未通过：' + failed.map((c) => c.name).join('；')); process.exitCode = 1; }
