import { getMergedWatchlistKR, getMergedWatchlistUS } from '../../lib/watchlist';

const US_SYMBOLS = [
  'QQQ', 'SPY', 'SOXX', '%5EVIX', 'NQ=F', 'ES=F', 'CL=F', 'USDKRW=X', 'NVDA',
  'AVGO', 'AMD', 'QCOM', 'MU', 'INTC', 'MRVL', 'TXN', 'AMAT', 'LRCX',
  'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'ORCL', 'CRM', 'ADBE',
  'TSLA', 'GM', 'F', 'STLA', 'RIVN',
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'BLK', 'SCHW',
  'UNH', 'LLY', 'JNJ', 'PFE', 'MRK', 'ABBV',
  'ALB', 'SQM', 'ENPH', 'LIN', 'APD',
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'EOG',
  'RTX', 'LMT', 'NOC', 'GD', 'BA',
  'CAT', 'GE', 'HON', 'UPS', 'DE',
  'FCX', 'NEM', 'SHW',
  'HD', 'TGT', 'NKE', 'SBUX', 'MCD', 'BKNG',
  'WMT', 'COST', 'PG', 'KO', 'PEP', 'PM',
  'NEE', 'SO', 'DUK', 'AEP',
  'AMT', 'PLD', 'EQIX', 'SPG',
  'VZ', 'T', 'TMUS', 'CMCSA', 'DIS',
  'IONQ', 'SPCX', 'SATL', 'CRCA', 'BMNU', 'IREN', 'LITE', 'SNDK', 'CRDO',
];

const KR_CODES = [
  '005930', '000660', '005380', '000270', '035420', '051910',
  '006400', '003670', '028260', '035720', '096770', '066570',
  '009150', '012330', '373220', '105560', '055550', '316140',
  '352820', '207940', '068270', '326030',
  '030200', '017670', '032640',
  '139480', '004170', '282330', '023530',
  '010950', '034730', '034020',
  '012450', '079550', '064350', '047810',
  '009540', '042660', '010140',
  '005490', '004020', '010130',
  '086790', '006800', '016360', '005940', '039490',
  '051900', '090430', '097950', '004370', '271560', '033780',
  '034220', '243880', '043260', '080220', '377300', '233740', '760026', '234340',
];

const KOSDAQ150_ETF = '229200';
const KOSDAQ150_INDEX_FACTOR = 9.34;
const NAVER_HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

async function fetchYahoo(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    const chg = prev ? ((price - prev) / prev) * 100 : null;
    return { price, chg };
  } catch { return null; }
}

function kstDateFromUnix(unixSec) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(unixSec * 1000));
}

function todayKstDateStrStock() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function parseYahooIntradayPoints(result) {
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((t, i) => ({ t, v: closes[i] }))
    .filter((p) => p.v != null);
}

function filterIntradayKstToday(points) {
  const today = todayKstDateStrStock();
  const filtered = (points || []).filter((p) => kstDateFromUnix(p.t) === today);
  return filtered.length >= 2 ? filtered : (points || []);
}

function kstTimeUnix(dateKey, hour, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return Math.floor(new Date(`${dateKey}T${hh}:${mm}:00+09:00`).getTime() / 1000);
}

function filterIntradayFromKstTime(points, hour, minute = 0) {
  const today = todayKstDateStrStock();
  const cutoff = kstTimeUnix(today, hour, minute);
  const filtered = (points || []).filter((p) => p.t >= cutoff);
  return filtered.length >= 2 ? filtered : (points || []);
}

async function fetchYahooIntraday(symbol, { kstTodayOnly = false } = {}) {
  try {
    // 반드시 raw 심볼(^KS11, NQ=F) — %5EKS11처럼 pre-encode하면 이중 인코딩되어 빈 배열
    const encoded = encodeURIComponent(symbol);
    const isFutures = /=F$/.test(symbol);

    if (isFutures) {
      const fetchFut = async (interval) => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=5d&includePrePost=true`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        if (!r.ok) return [];
        return parseYahooIntradayPoints((await r.json())?.chart?.result?.[0]);
      };

      let points = await fetchFut('2m');
      if (points.length < 2) points = await fetchFut('5m');
      if (points.length < 2) return [];

      const latest = points[points.length - 1].t;
      const cutoff = latest - 24 * 3600;
      const recent = points.filter((p) => p.t >= cutoff);
      return recent.length >= 2 ? recent : points.slice(-120);
    }

    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!r.ok) return [];
    let points = parseYahooIntradayPoints((await r.json())?.chart?.result?.[0]);
    if (kstTodayOnly) points = filterIntradayKstToday(points);
    return points;
  } catch { return []; }
}

function getKstDateString() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseInvestorFlowValue(raw) {
  const n = parseInt(String(raw).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseInvestorFlowHistoryHtml(html) {
  const rowRe = /<td class="date2">(\d{2}:\d{2})<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/g;
  const rows = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    rows.push({
      time: m[1],
      individual: parseInvestorFlowValue(m[2]),
      foreign: parseInvestorFlowValue(m[3]),
      institution: parseInvestorFlowValue(m[4]),
    });
  }
  return rows;
}

async function fetchInvestorFlowData(sosok) {
  try {
    const bizdate = getKstDateString();
    const byTime = new Map();

    for (let page = 1; page <= 12; page += 1) {
      const r = await fetch(
        `https://finance.naver.com/sise/investorDealTrendTime.naver?sosok=${sosok}&bizdate=${bizdate}&page=${page}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!r.ok) break;
      const buf = await r.arrayBuffer();
      const html = new TextDecoder('euc-kr').decode(buf);
      const rows = parseInvestorFlowHistoryHtml(html);
      if (!rows.length) break;
      rows.forEach((row) => byTime.set(row.time, row));
      if (rows.length < 8) break;
    }

    const history = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
    return {
      latest: history.length ? history[history.length - 1] : null,
      history,
    };
  } catch { return { latest: null, history: [] }; }
}

async function fetchNaverStock(code) {
  try {
    const r = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`, { headers: NAVER_HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    const item = d?.datas?.[0];
    if (!item) return null;
    return {
      price: parseFloat(item.closePriceRaw),
      chg: parseFloat(item.fluctuationsRatioRaw ?? item.fluctuationsRatio),
    };
  } catch { return null; }
}

function parseKrPrice(raw) {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** NXT 프리/애프터 등 비정규장 — 네이버 m.stock basic API */
async function fetchNaverStockExtended(code) {
  try {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers: NAVER_HEADERS });
    if (!r.ok) return null;
    const over = (await r.json())?.overMarketPriceInfo;
    if (!over?.overPrice) return null;
    const price = parseKrPrice(over.overPrice);
    const chg = parseFloat(over.fluctuationsRatio);
    if (!Number.isFinite(price)) return null;
    return {
      price,
      chg: Number.isFinite(chg) ? chg : null,
      session: over.tradingSessionType || 'NXT',
    };
  } catch { return null; }
}

function getUsMarketSession(meta) {
  const now = Math.floor(Date.now() / 1000);
  const p = meta?.currentTradingPeriod;
  if (!p) return 'CLOSED';
  if (p.pre && now >= p.pre.start && now < p.pre.end) return 'PRE';
  if (p.regular && now >= p.regular.start && now < p.regular.end) return 'REGULAR';
  if (p.post && now >= p.post.start && now < p.post.end) return 'POST';
  return 'CLOSED';
}

function findLatestCandleInWindow(timestamps, closes, start, end) {
  for (let i = timestamps.length - 1; i >= 0; i -= 1) {
    const t = timestamps[i];
    const c = closes[i];
    if (c == null || t == null) continue;
    if (t >= start && t < end) return c;
  }
  return null;
}

function classifyUsSession(timestamp, p) {
  if (!p || timestamp == null) return null;
  if (p.pre && timestamp >= p.pre.start && timestamp < p.pre.end) return 'PRE';
  if (p.regular && timestamp >= p.regular.start && timestamp < p.regular.end) return 'REGULAR';
  if (p.post && timestamp >= p.post.start && timestamp < p.post.end) return 'POST';
  return null;
}

function findLatestCandleAny(timestamps, closes) {
  for (let i = timestamps.length - 1; i >= 0; i -= 1) {
    if (closes[i] != null && timestamps[i] != null) return { t: timestamps[i], price: closes[i] };
  }
  return null;
}

/** 미국 프리/애프터 — Yahoo 1분봉(includePrePost), 현재 세션 또는 최신 체결가 */
async function fetchYahooExtended(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!r.ok) return null;
    const result = (await r.json())?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose;
    if (!prev) return null;

    const session = getUsMarketSession(meta);
    const p = meta.currentTradingPeriod;
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    const pack = (price, sess) => ({
      price,
      chg: ((price - prev) / prev) * 100,
      session: sess,
    });

    if (session === 'PRE') {
      const px = findLatestCandleInWindow(timestamps, closes, p?.pre?.start, p?.pre?.end);
      const price = meta.preMarketPrice ?? px ?? findLatestCandleAny(timestamps, closes)?.price;
      if (price != null) return pack(price, 'PRE');
    }

    if (session === 'POST') {
      const px = findLatestCandleInWindow(timestamps, closes, p?.post?.start, p?.post?.end);
      const price = meta.postMarketPrice ?? px ?? findLatestCandleAny(timestamps, closes)?.price;
      if (price != null) return pack(price, 'POST');
    }

    if (session === 'REGULAR') {
      const price = meta.regularMarketPrice
        ?? findLatestCandleInWindow(timestamps, closes, p?.regular?.start, p?.regular?.end)?.price;
      if (price != null) return pack(price, 'REGULAR');
    }

    // 장외(프리 시작 전·주말 등): 차트 최신 체결가 → 세션 라벨 추론
    const latest = findLatestCandleAny(timestamps, closes);
    if (latest) {
      let inferred = classifyUsSession(latest.t, p);
      if (!inferred && p?.pre?.start && latest.t < p.pre.start) inferred = 'POST';
      if (!inferred) inferred = 'POST';
      return pack(latest.price, inferred);
    }

    if (meta.regularMarketPrice != null) return pack(meta.regularMarketPrice, 'REGULAR');
    return null;
  } catch { return null; }
}

function parseNaverPollingItem(d) {
  const item = d?.datas?.[0];
  if (!item) return null;
  const price = parseFloat(item.closePriceRaw ?? String(item.closePrice ?? '').replace(/,/g, ''));
  const chg = parseFloat(item.fluctuationsRatioRaw ?? item.fluctuationsRatio);
  if (!Number.isFinite(price)) return null;
  return { price, chg: Number.isFinite(chg) ? chg : null };
}

async function fetchNaverPolling(path) {
  try {
    const r = await fetch(`https://polling.finance.naver.com/api/realtime/${path}`, { headers: NAVER_HEADERS });
    if (!r.ok) return null;
    return parseNaverPollingItem(await r.json());
  } catch { return null; }
}

async function fetchNaverIndex(code) {
  return fetchNaverPolling(`domestic/index/${code}`);
}

async function fetchNaverWorldIndex(symbol) {
  return fetchNaverPolling(`worldstock/index/${symbol}`);
}

// 코스피200 야간선물 — KRX/HTS 종목코드 (캡처 코드표 기준)
const KOSPI_NIGHT_SYMBOLS = [
  { path: 'worldstock/index/K2FA001.N', source: 'naver-k2fa001', label: 'KOSPI200 야간선물' },
  { path: 'worldstock/index/FUT.NG.KS200', source: 'naver-fut-ng', label: 'KOSPI200 야간선물' },
  { path: 'worldstock/index/M2FA001.N', source: 'naver-m2fa001', label: '미니 KOSPI200 야간' },
  { path: 'worldstock/index/CKFA020', source: 'naver-cme', label: 'CME KOSPI200 야간' },
];

async function fetchKospi200Index() {
  const naver = await fetchNaverIndex('KPI200');
  if (naver) return { ...naver, source: 'naver', label: '코스피200' };
  const yahoo = await fetchYahoo('KOSPI200.KS');
  if (yahoo?.price != null) return { ...yahoo, source: 'yahoo', label: '코스피200' };
  return null;
}

function getKstNow() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return { hour: kst.getHours(), minute: kst.getMinutes(), day: kst.getDay() };
}

function isNightFuturesSession() {
  const { hour, day } = getKstNow();
  if (day === 0 || day === 6) return false;
  return hour >= 18 || hour < 6; // 18:00 ~ 익일 06:00 KST (KRX 야간)
}

const MOBILE_STOCK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  Referer: 'https://m.stock.naver.com/',
  Accept: 'application/json',
};

async function fetchNaverMobileFrontBasic(code) {
  try {
    const r = await fetch(
      `https://m.stock.naver.com/front-api/stock/domestic/basic?code=${encodeURIComponent(code)}&endType=index`,
      { headers: MOBILE_STOCK_HEADERS },
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.isSuccess === false) return null;
    const item = j?.result;
    const price = parseFloat(String(item?.closePrice ?? '').replace(/,/g, ''));
    const chg = parseFloat(item?.fluctuationsRatio);
    if (!Number.isFinite(price)) return null;
    return { price, chg: Number.isFinite(chg) ? chg : null };
  } catch { return null; }
}

function isDayFuturesSession() {
  const { hour, minute, day } = getKstNow();
  if (day === 0 || day === 6) return false;
  const t = hour * 60 + minute;
  return t >= 525 && t <= 945; // 08:45 ~ 15:45 KST
}

async function fetchFirstNaverPolling(candidates) {
  const results = await Promise.all(candidates.map(({ path }) => fetchNaverPolling(path)));
  for (let i = 0; i < candidates.length; i += 1) {
    if (results[i]?.price != null) {
      return { ...results[i], ...candidates[i] };
    }
  }
  return null;
}

async function fetchKospiDayFutures() {
  if (!isDayFuturesSession()) {
    return { price: null, chg: null, source: 'closed', label: '주간 휴장 (08:45~15:45)', session: 'closed' };
  }
  const dayFut = await fetchFirstNaverPolling([
    { path: 'domestic/index/FUT', source: 'naver-day-fut', label: '주간선물' },
    { path: 'worldstock/index/FUT.KS200', source: 'naver-day-fut-world', label: '주간선물' },
  ]);
  if (dayFut) {
    return { price: dayFut.price, chg: dayFut.chg, source: dayFut.source, label: dayFut.label, session: 'day' };
  }
  return { price: null, chg: null, source: 'day-pending', label: '주간장 연결중', session: 'day-wait' };
}

async function fetchTradingViewKospi200Fut(ticker = 'KRX:K2I1!') {
  try {
    const r = await fetch('https://scanner.tradingview.com/futures/scan', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        Origin: 'https://www.tradingview.com',
        Referer: 'https://www.tradingview.com/',
      },
      body: JSON.stringify({
        symbols: { tickers: [ticker], query: { types: [] } },
        columns: ['name', 'close', 'change'],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const row = j?.data?.[0]?.d;
    if (!row) return null;
    const price = parseFloat(row[1]);
    const chg = parseFloat(row[2]);
    if (!Number.isFinite(price)) return null;
    return { price, chg: Number.isFinite(chg) ? chg : null };
  } catch { return null; }
}

async function fetchKospiNightFuturesOnly() {
  const inNight = isNightFuturesSession();

  const nightCandidates = [
    ...KOSPI_NIGHT_SYMBOLS,
    { path: 'domestic/index/FUT.NG', source: 'naver-dom-ng', label: 'KOSPI200 야간선물' },
    { path: 'domestic/index/K2FA001.N', source: 'naver-dom-k2fa', label: 'KOSPI200 야간선물' },
  ];
  const night = await fetchFirstNaverPolling(nightCandidates);
  if (night?.price != null) {
    return { price: night.price, chg: night.chg, source: night.source, label: night.label, session: 'night' };
  }

  const tv = await fetchTradingViewKospi200Fut();
  if (tv?.price != null) {
    return {
      price: tv.price,
      chg: tv.chg,
      source: 'tradingview-k2i1',
      label: inNight ? 'KOSPI200 야간선물' : 'KOSPI200 선물 (K2I1!)',
      session: inNight ? 'night' : 'tv-closed',
    };
  }

  if (inNight) {
    return { price: null, chg: null, source: 'night-pending', label: '야간장 연결중', session: 'night-wait' };
  }

  const dayRef = await fetchFirstNaverPolling([
    { path: 'domestic/index/FUT', source: 'naver-day-fut', label: '주간선물' },
  ]);
  const mobileRef = dayRef ?? await fetchNaverMobileFrontBasic('FUT');
  if (mobileRef?.price != null) {
    return {
      price: mobileRef.price,
      chg: mobileRef.chg,
      source: dayRef?.source ?? 'naver-mobile-fut',
      label: '야간 휴장 · 주간 선물',
      session: 'day-fallback',
    };
  }

  return { price: null, chg: null, source: 'closed', label: '야간 휴장 (18:00~06:00)', session: 'closed' };
}

async function fetchKosdaq150() {
  const etf = await fetchNaverStock(KOSDAQ150_ETF);
  if (etf?.price != null) {
    return {
      price: +(etf.price / KOSDAQ150_INDEX_FACTOR).toFixed(2),
      chg: etf.chg,
      source: 'etf-proxy',
      label: '코스닥150',
    };
  }
  const kosdaq = await fetchNaverIndex('KOSDAQ');
  if (kosdaq) return { ...kosdaq, source: 'kosdaq-composite', label: '코스닥(대체)' };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  try {
    const quickUs = String(req.query.quoteUs || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const quickKr = String(req.query.quoteKr || '').split(',').map((s) => s.trim()).filter((s) => /^\d{6}$/.test(s));
    if (req.query.quick === '1' && (quickUs.length || quickKr.length)) {
      res.setHeader('Cache-Control', 'no-store');
      const heatUS = {};
      const heatUSExtended = {};
      await Promise.all(quickUs.map(async (sym) => {
        const reg = await fetchYahoo(sym);
        const ext = await fetchYahooExtended(sym);
        const merged = ext ?? (reg ? { ...reg, session: reg.session || 'REGULAR' } : null);
        if (reg) heatUS[sym] = reg;
        if (merged) heatUSExtended[sym] = merged;
      }));
      const heatKR = {};
      const heatKRExtended = {};
      await Promise.all(quickKr.map(async (code) => {
        const reg = await fetchNaverStock(code);
        const ext = await fetchNaverStockExtended(code);
        if (reg) heatKR[code] = reg;
        heatKRExtended[code] = ext ?? reg ?? null;
      }));
      return res.status(200).json({ heatUS, heatKR, heatUSExtended, heatKRExtended });
    }

    const clientExtraKr = String(req.query.extraKr || '').split(',').map((s) => s.trim()).filter((s) => /^\d{6}$/.test(s));
    const clientExtraUs = String(req.query.extraUs || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

    const usResults = await Promise.all(US_SYMBOLS.map(fetchYahoo));
    const usMap = {};
    US_SYMBOLS.forEach((sym, i) => { usMap[sym] = usResults[i]; });

    const extraUs = [...new Set([
      ...getMergedWatchlistUS().map((x) => x.sym),
      ...clientExtraUs,
    ])].filter((sym) => !US_SYMBOLS.includes(sym));
    if (extraUs.length) {
      const extraUsResults = await Promise.all(extraUs.map(fetchYahoo));
      extraUs.forEach((sym, i) => { usMap[sym] = extraUsResults[i]; });
    }

    const krResults = await Promise.all(KR_CODES.map(fetchNaverStock));
    const krMap = {};
    KR_CODES.forEach((code, i) => { krMap[code] = krResults[i]; });

    const extraKr = [...new Set([
      ...getMergedWatchlistKR().map((x) => x.code),
      ...clientExtraKr,
    ])].filter((code) => !KR_CODES.includes(code));
    if (extraKr.length) {
      const extraKrResults = await Promise.all(extraKr.map(fetchNaverStock));
      extraKr.forEach((code, i) => { krMap[code] = extraKrResults[i]; });
    }

    const mergedKr = getMergedWatchlistKR();
    const mergedUs = getMergedWatchlistUS();
    const extKrCodes = [...new Set([...mergedKr.map((x) => x.code), ...extraKr])];
    const extUsSyms = [...new Set([...mergedUs.map((x) => x.sym), ...extraUs])];
    const [extKrResults, extUsResults] = await Promise.all([
      Promise.all(extKrCodes.map((code) => fetchNaverStockExtended(code))),
      Promise.all(extUsSyms.map((sym) => fetchYahooExtended(sym))),
    ]);
    const krExtMap = {};
    extKrCodes.forEach((code, i) => {
      krExtMap[code] = extKrResults[i] ?? krMap[code] ?? null;
    });
    const usExtMap = {};
    extUsSyms.forEach((sym, i) => {
      const ext = extUsResults[i];
      const reg = usMap[sym];
      usExtMap[sym] = ext ?? (reg ? { ...reg, session: 'REGULAR' } : null);
    });

    const [
      kospi200, kospiDayFut, kospiNightFut, kosdaq150, kospi, kosdaq,
      kospiFlow, kosdaqFlow, kospiIntraday, kosdaqIntraday, nasdaqFutIntraday,
    ] = await Promise.all([
      fetchKospi200Index(),
      fetchKospiDayFutures(),
      fetchKospiNightFuturesOnly(),
      fetchKosdaq150(),
      fetchNaverIndex('KOSPI'),
      fetchNaverIndex('KOSDAQ'),
      fetchInvestorFlowData('01'),
      fetchInvestorFlowData('02'),
      fetchYahooIntraday('^KS11', { kstTodayOnly: true }),
      fetchYahooIntraday('^KQ11', { kstTodayOnly: true }),
      fetchYahooIntraday('NQ=F').then((pts) => filterIntradayFromKstTime(pts, 5)),
    ]);

    const g = (sym) => usMap[sym] ?? { price: null, chg: null };

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      nasdaq: g('QQQ').price, nasdaqChg: g('QQQ').chg,
      nasdaqFut: g('NQ=F').price, nasdaqFutChg: g('NQ=F').chg,
      sp500: g('SPY').price, sp500Chg: g('SPY').chg,
      sp500Fut: g('ES=F').price, sp500FutChg: g('ES=F').chg,
      sox: g('SOXX').price, soxChg: g('SOXX').chg,
      nvda: g('NVDA').price, nvdaChg: g('NVDA').chg,
      samsung: krMap['005930']?.price, samsungChg: krMap['005930']?.chg,
      hynix: krMap['000660']?.price, hynixChg: krMap['000660']?.chg,
      wti: g('CL=F').price, wtiChg: g('CL=F').chg,
      usdkrw: g('USDKRW=X').price, usdkrwChg: g('USDKRW=X').chg,
      vix: g('%5EVIX').price, vixChg: g('%5EVIX').chg,
      kospi200: kospi200?.price ?? null,
      kospi200Chg: kospi200?.chg ?? null,
      kospi200Label: kospi200?.label ?? null,
      kospiDay: kospiDayFut?.price ?? null,
      kospiDayChg: kospiDayFut?.chg ?? null,
      kospiDayLabel: kospiDayFut?.label ?? null,
      kospiDaySession: kospiDayFut?.session ?? null,
      kospiDaySource: kospiDayFut?.source ?? null,
      kospiNight: kospiNightFut?.price ?? null,
      kospiNightChg: kospiNightFut?.chg ?? null,
      kospiNightLabel: kospiNightFut?.label ?? null,
      kospiNightSession: kospiNightFut?.session ?? null,
      kospiNightSource: kospiNightFut?.source ?? null,
      kosdaq150: kosdaq150?.price ?? null,
      kosdaq150Chg: kosdaq150?.chg ?? null,
      kosdaq150Label: kosdaq150?.label ?? null,
      kospi: kospi?.price ?? null,
      kospiChg: kospi?.chg ?? null,
      kosdaq: kosdaq?.price ?? null,
      kosdaqChg: kosdaq?.chg ?? null,
      kospiFut: kospi200?.price ?? null,
      kospiFutChg: kospi200?.chg ?? null,
      kospiFutSource: kospi200?.source ?? null,
      kospiFutLabel: kospi200?.label ?? null,
      heatUS: usMap,
      heatKR: krMap,
      heatKRExtended: krExtMap,
      heatUSExtended: usExtMap,
      watchlist: {
        kr: mergedKr.map((item) => ({
          ...item,
          price: krMap[item.code]?.price ?? null,
          chg: krMap[item.code]?.chg ?? null,
        })),
        us: mergedUs.map((item) => ({
          ...item,
          price: usMap[item.sym]?.price ?? null,
          chg: usMap[item.sym]?.chg ?? null,
        })),
      },
      watchlistExtended: {
        kr: mergedKr.map((item) => ({
          ...item,
          price: krExtMap[item.code]?.price ?? null,
          chg: krExtMap[item.code]?.chg ?? null,
          session: krExtMap[item.code]?.session ?? null,
        })),
        us: mergedUs.map((item) => ({
          ...item,
          price: usExtMap[item.sym]?.price ?? null,
          chg: usExtMap[item.sym]?.chg ?? null,
          session: usExtMap[item.sym]?.session ?? null,
        })),
      },
      investorFlow: {
        kospi: { latest: kospiFlow.latest, history: kospiFlow.history },
        kosdaq: { latest: kosdaqFlow.latest, history: kosdaqFlow.history },
      },
      intraday: {
        kospi: kospiIntraday,
        kosdaq: kosdaqIntraday,
        nasdaqFut: nasdaqFutIntraday,
      },
    });
  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({ error: error.message, heatUS: {}, heatKR: {} });
  }
}
