/**
 * KOSPI + KOSDAQ 전 종목 → lib/krIndexUniverse.json
 * 출처: 네이버 금융 시가총액 (sosok=0 코스피, sosok=1 코스닥)
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

const MARKET = {
  kospi: { sosok: 0, label: 'KOSPI' },
  kosdaq: { sosok: 1, label: 'KOSDAQ' },
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

async function scrapeMarketFull(sosok, marketLabel, maxPages = 120) {
  const map = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
    const html = await fetchHtml(url);
    const batch = parseTableStocks(html);
    const before = map.size;
    batch.forEach(({ code, label }) => map.set(code, label));
    console.log(`  ${marketLabel} p${page}: +${map.size - before} (total ${map.size})`);
    if (batch.length === 0) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return map;
}

async function main() {
  console.log('Fetching KOSPI 전 종목...');
  const kospi = await scrapeMarketFull(MARKET.kospi.sosok, MARKET.kospi.label);

  console.log('Fetching KOSDAQ 전 종목...');
  const kosdaq = await scrapeMarketFull(MARKET.kosdaq.sosok, MARKET.kosdaq.label);

  const merged = new Map([...kospi, ...kosdaq]);
  const items = [...merged.entries()]
    .map(([code, label]) => ({ code, label, aliases: [] }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const payload = {
    updatedAt: new Date().toISOString(),
    note: 'KOSPI+KOSDAQ 전 상장종목 (네이버 시가총액 페이지 기준)',
    sources: {
      kospi: kospi.size,
      kosdaq: kosdaq.size,
      merged: merged.size,
    },
    items,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`\nSaved ${items.length} stocks → ${OUT}`);
  console.log(`  KOSPI: ${kospi.size}, KOSDAQ: ${kosdaq.size}, merged: ${merged.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
