/**
 * KOSPI 200 + KOSDAQ 150(시총 상위 150) → lib/krIndexUniverse.json
 * 출처: 네이버 금융 (entryJongmok KPI200, 시가총액 코스닥)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../lib/krIndexUniverse.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://finance.naver.com/',
  Accept: 'text/html,application/xhtml+xml',
};

function decodeHtml(buf) {
  try {
    return new TextDecoder('euc-kr').decode(buf);
  } catch {
    return Buffer.from(buf).toString('utf8');
  }
}

async function fetchHtml(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return decodeHtml(Buffer.from(await r.arrayBuffer()));
}

function parseTableStocks(html) {
  const list = [];
  const seen = new Set();
  const rows = [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((x) => x[0]);
  for (const row of rows) {
    const m = row.match(/<td[^>]*>\s*<a href="\/item\/main\.naver\?code=(\d{6})"[^>]*>([^<]+)<\/a>/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    list.push({ code: m[1], label: m[2].replace(/&amp;/g, '&').trim() });
  }
  return list;
}

async function scrapeKospi200(maxPages = 22) {
  const map = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://finance.naver.com/sise/entryJongmok.naver?type=KPI200&page=${page}`;
    const html = await fetchHtml(url);
    const batch = parseTableStocks(html);
    const before = map.size;
    batch.forEach(({ code, label }) => map.set(code, label));
    console.log(`  KOSPI200 p${page}: +${map.size - before} (total ${map.size})`);
    if (batch.length === 0) break;
  }
  return map;
}

/** 네이버 시가총액 — sosok=1 코스닥 (2026 기준) */
async function scrapeKosdaqTop(limit = 150, maxPages = 5) {
  const list = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages && list.length < limit; page += 1) {
    const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=1&page=${page}`;
    const html = await fetchHtml(url);
    const batch = parseTableStocks(html);
    for (const item of batch) {
      if (seen.has(item.code)) continue;
      seen.add(item.code);
      list.push(item);
      if (list.length >= limit) break;
    }
    console.log(`  KOSDAQ p${page}: batch ${batch.length}, collected ${list.length}`);
    if (batch.length === 0) break;
  }
  return new Map(list.map((x) => [x.code, x.label]));
}

async function main() {
  console.log('Fetching KOSPI 200 (네이버 KPI200)...');
  const kospi200 = await scrapeKospi200();

  console.log('Fetching KOSDAQ top 150 (네이버 시가총액)...');
  const kosdaq150 = await scrapeKosdaqTop(150);

  const merged = new Map([...kospi200, ...kosdaq150]);
  const items = [...merged.entries()]
    .map(([code, label]) => ({ code, label, aliases: [] }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const payload = {
    updatedAt: new Date().toISOString(),
    note: 'KOSPI200=네이버 KPI200 구성종목, KOSDAQ150=코스닥 시가총액 상위 150 (코스닥150 지수 근사)',
    sources: {
      kospi200: kospi200.size,
      kosdaq150: kosdaq150.size,
    },
    items,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`\nSaved ${items.length} stocks → ${OUT}`);
  console.log(`  KOSPI200: ${kospi200.size}, KOSDAQ150: ${kosdaq150.size}, merged: ${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
