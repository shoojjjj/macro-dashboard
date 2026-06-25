import { getMergedWatchlistKR, getMergedWatchlistUS } from '../../lib/watchlist';
import {
  todayKstDateStr,
  addDaysKst,
  unixToKst,
  sortEvents,
  dedupeEvents,
  filterEventsInRange,
} from '../../lib/eventTimeline';

const UA = { 'User-Agent': 'Mozilla/5.0' };
const CACHE_TTL_MS = 30 * 60 * 1000;
const YAHOO_TIMEOUT_MS = 4500;
const YAHOO_POOL = 4;
const EVENT_FETCH_DAYS = 45;
const EVENT_VIEW_OPTIONS = [7, 14, 35];
const EARNINGS_SCAN_US = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'INTC',
  'NFLX', 'CRM', 'ORCL', 'QCOM', 'MU', 'LRCX', 'COIN', 'SHOP', 'UBER', 'PYPL',
];
/** 국내 주요 기업 — Yahoo 실적 + 네이버 공시(실적/ADR/IR) */
const EARNINGS_SCAN_KR = [
  { code: '005930', label: '삼성전자', adr: 'SSNLF' },
  { code: '000660', label: 'SK하이닉스' },
  { code: '035420', label: 'NAVER' },
  { code: '035720', label: '카카오' },
  { code: '005380', label: '현대차' },
  { code: '000270', label: '기아' },
  { code: '051910', label: 'LG화학' },
  { code: '006400', label: '삼성SDI' },
  { code: '068270', label: '셀트리온' },
  { code: '207940', label: '삼성바이오' },
  { code: '373220', label: 'LG에너지' },
  { code: '034020', label: '두산에너빌리티' },
  { code: '028260', label: '삼성물산' },
  { code: '012330', label: '현대모비스' },
];

let cache = { at: 0, payload: null };

/** FRED release_id → 한글 라벨 · 기본 KST 시각(미국 8:30 ET ≈ 21:30 KST) */
const FRED_MACRO = [
  { id: 10, title: '미 CPI(소비자물가)', importance: 3, timeKst: '21:30', note: 'BLS · 전월 대비 물가 · 변동성 유의' },
  { id: 50, title: '미 비농업 고용(NFP)', importance: 3, timeKst: '21:30', note: 'BLS · 신규 고용·실업률' },
  { id: 53, title: '미 GDP', importance: 2, timeKst: '21:30', note: 'BEA · 분기 성장률' },
  { id: 54, title: '미 PCE(개인소비)', importance: 3, timeKst: '21:30', note: 'BEA · Fed 선호 인플레 지표' },
  { id: 180, title: '미 신규 실업수당', importance: 2, timeKst: '21:30', note: '주간 고용 지표' },
  { id: 11, title: '미 PPI(생산자물가)', importance: 2, timeKst: '21:30', note: 'BLS · 생산자물가' },
  { id: 21, title: '미 소매판매', importance: 2, timeKst: '21:30', note: 'Census · 소비 동향' },
];

/** Fed FOMC 성명일(미 동부, 14:00 ET ≈ 익일 03:00 KST) — FRED 101은 일별 보도자료라 제외 */
const FOMC_DECISIONS = [
  { date: '2025-01-29', span: '1/28-29' },
  { date: '2025-03-19', span: '3/18-19', sep: true },
  { date: '2025-05-07', span: '5/6-7' },
  { date: '2025-06-18', span: '6/17-18', sep: true },
  { date: '2025-07-30', span: '7/29-30' },
  { date: '2025-09-17', span: '9/16-17', sep: true },
  { date: '2025-10-29', span: '10/28-29' },
  { date: '2025-12-10', span: '12/9-10', sep: true },
  { date: '2026-01-28', span: '1/27-28' },
  { date: '2026-03-18', span: '3/17-18', sep: true },
  { date: '2026-04-29', span: '4/28-29' },
  { date: '2026-06-17', span: '6/16-17', sep: true },
  { date: '2026-07-29', span: '7/28-29' },
  { date: '2026-09-16', span: '9/15-16', sep: true },
  { date: '2026-10-28', span: '10/27-28' },
  { date: '2026-12-09', span: '12/8-9', sep: true },
  { date: '2027-01-27', span: '1/26-27' },
  { date: '2027-03-17', span: '3/16-17', sep: true },
  { date: '2027-04-28', span: '4/27-28' },
  { date: '2027-06-09', span: '6/8-9', sep: true },
  { date: '2027-07-28', span: '7/27-28' },
  { date: '2027-09-15', span: '9/14-15', sep: true },
  { date: '2027-10-27', span: '10/26-27' },
  { date: '2027-12-08', span: '12/7-8', sep: true },
];

/** 미국 경제지표 발표 시각(ET) → KST (EDT/KST +13h, EST/KST +14h — 3~11월 EDT) */
function usEtReleaseToKst(dateStr, hourEt = 8, minuteEt = 30) {
  const month = Number(dateStr.slice(5, 7));
  const offsetHours = month >= 3 && month <= 10 ? 13 : 14;
  let totalMin = hourEt * 60 + minuteEt + offsetHours * 60;
  let dayShift = 0;
  while (totalMin >= 24 * 60) {
    dayShift += 1;
    totalMin -= 24 * 60;
  }
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return { date: addDaysKst(dateStr, dayShift), timeKst: `${hh}:${mm}` };
}

function generateFomcEvents(start, endExclusive) {
  return FOMC_DECISIONS.map((m) => {
    const kst = usEtReleaseToKst(m.date, 14, 0);
    const kstNote = kst.date !== m.date ? ` · KST ${kst.date.slice(5).replace('-', '/')} ${kst.timeKst}` : '';
    return {
      date: m.date,
      timeKst: kst.timeKst,
      title: `FOMC 금리 결정 (${m.span})`,
      category: '매크로',
      importance: 3,
      note: (m.sep ? 'Fed · FOMC 성명 · SEP·점도표' : 'Fed · FOMC 성명') + kstNote,
      source: 'fed',
    };
  }).filter((e) => e.date >= start && e.date < endExclusive);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function yahooAuth() {
  const r1 = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const crumb = await (await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...UA, Cookie: cookie },
  })).text();
  return { cookie, crumb };
}

function collectYahooEarningDates(earn) {
  const rows = [];
  for (const row of earn.earningsDate || []) {
    if (row?.raw) rows.push({ ...unixToKst(row.raw), kind: 'earn' });
    else if (row?.fmt) rows.push({ date: row.fmt, timeKst: null, kind: 'earn' });
  }
  for (const row of earn.earningsCallDate || []) {
    if (row?.raw) rows.push({ ...unixToKst(row.raw), kind: 'call' });
  }
  return rows.filter((r) => r.date);
}

function pickUpcomingEarningsDate(earn, rangeStart, rangeEndExclusive) {
  const rows = collectYahooEarningDates(earn);
  if (!rows.length) return null;

  const inRange = rows
    .filter((r) => r.date >= rangeStart && r.date < rangeEndExclusive)
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return a.kind === 'earn' ? -1 : 1;
    });
  if (inRange.length) return inRange[0];

  const earnOnly = rows.filter((r) => r.kind === 'earn').sort((a, b) => a.date.localeCompare(b.date));
  const latestEarn = earnOnly[earnOnly.length - 1];
  if (latestEarn?.date && latestEarn.date < rangeStart) {
    let projected = latestEarn.date;
    while (projected < rangeStart) projected = addDaysKst(projected, 91);
    if (projected < rangeEndExclusive) {
      return { date: projected, timeKst: '08:00', projected: true };
    }
  }
  return null;
}

async function fetchYahooEarnings(yahooSym, label, market, auth, rangeStart, rangeEndExclusive) {
  try {
    const { cookie, crumb } = auth;
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSym)}?modules=calendarEvents&crumb=${encodeURIComponent(crumb)}`;
    const r = await withTimeout(
      fetch(url, { headers: { ...UA, Cookie: cookie } }),
      YAHOO_TIMEOUT_MS,
    );
    if (!r.ok) return null;
    const d = await r.json();
    const earn = d?.quoteSummary?.result?.[0]?.calendarEvents?.earnings;
    if (!earn?.earningsDate?.length) return null;

    const pick = pickUpcomingEarningsDate(earn, rangeStart, rangeEndExclusive);
    if (!pick?.date) return null;

    const eps = earn.earningsAverage?.fmt;
    const timing = market === 'kr'
      ? (pick.projected ? '분기 실적(추정)' : pick.timeKst ? '실적 발표' : '장 시작 전후(추정)')
      : (pick.timeKst && parseInt(pick.timeKst.split(':')[0], 10) < 12 ? '장 시작 전(BMO)' : '장 마감 후(AMC)');

    return {
      date: pick.date,
      timeKst: pick.timeKst || (market === 'kr' ? '08:00' : null),
      title: `${label}(${yahooSym.replace('.KS', '')}) 실적`,
      category: '기업실적',
      importance: 3,
      note: [
        timing,
        eps ? `컨센 EPS ${eps}` : null,
        earn.isEarningsDateEstimate || pick.projected ? '일정 추정' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

function isoToKstEvent(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, timeKst: null };
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d),
    timeKst: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d),
  };
}

function classifyKrDisclosure(title, label) {
  const short = title.replace(/^.*?\)\s*/, '').trim();
  if (/잠정.?실적|영업\(잠정\)|분기.?실적|연결재무제표기준영업/i.test(title)) {
    return {
      title: `${label} 잠정실적`,
      category: '기업실적',
      importance: 3,
      note: short,
    };
  }
  if (/예탁증권|\(DR\)|ADR|해외증권시장.*상장|Depositary/i.test(title)) {
    return {
      title: `${label} ADR/DR`,
      category: '국내이슈',
      importance: 3,
      note: short,
    };
  }
  if (/기업설명회|\bIR\b/i.test(title)) {
    return {
      title: `${label} IR`,
      category: '국내이슈',
      importance: 2,
      note: short,
    };
  }
  if (/배당락|유상증자|무상증자|전환사채|신주발행/i.test(title)) {
    return {
      title: `${label} ${short.slice(0, 18)}`,
      category: '국내이슈',
      importance: 2,
      note: '공시 · 네이버',
    };
  }
  return null;
}

async function fetchNaverKrDisclosures(code, label, start, endExclusive) {
  try {
    const r = await withTimeout(
      fetch(`https://m.stock.naver.com/api/stock/${code}/disclosure?pageSize=40`, {
        headers: { ...UA, Accept: 'application/json' },
      }),
      6000,
    );
    if (!r.ok) return [];
    const rows = await r.json();
    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        const meta = classifyKrDisclosure(row.title || '', label);
        if (!meta) return null;
        const kst = isoToKstEvent(row.datetime);
        if (!kst.date || kst.date < start || kst.date >= endExclusive) return null;
        return {
          date: kst.date,
          timeKst: kst.timeKst,
          title: meta.title,
          category: meta.category,
          importance: meta.importance,
          note: meta.note,
          source: 'naver',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function mergeKrScanTargets() {
  const wl = getMergedWatchlistKR();
  const byCode = new Map(EARNINGS_SCAN_KR.map((x) => [x.code, { ...x }]));
  for (const item of wl) {
    if (!byCode.has(item.code)) byCode.set(item.code, { code: item.code, label: item.label });
  }
  return [...byCode.values()];
}

async function fetchFredReleaseDates(releaseId, start, endInclusive) {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];
  const rtStart = addDaysKst(start, -120);
  const rtEnd = addDaysKst(endInclusive, 120);
  const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${releaseId}&realtime_start=${rtStart}&realtime_end=${rtEnd}&include_release_dates_with_no_data=true&api_key=${key}&file_type=json`;
  try {
    const r = await withTimeout(fetch(url), 6000);
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.release_dates || []).filter((row) => row.date >= start && row.date <= endInclusive);
  } catch {
    return [];
  }
}

async function fetchFredMacro(start, endExclusive) {
  const key = process.env.FRED_API_KEY;
  if (!key) return [];

  const endInclusive = addDaysKst(endExclusive, -1);
  const metaById = Object.fromEntries(FRED_MACRO.map((m) => [String(m.id), m]));

  const batches = await Promise.all(
    FRED_MACRO.map((m) => fetchFredReleaseDates(m.id, start, endInclusive)),
  );

  return batches.flatMap((dates, i) => {
    const meta = FRED_MACRO[i];
    return dates.map((row) => ({
      date: row.date,
      timeKst: meta.timeKst,
      title: meta.title,
      category: '매크로',
      importance: meta.importance,
      note: meta.note,
      source: 'fred',
    }));
  });
}

function kstDayOfWeek(dateStr) {
  return new Date(`${dateStr}T12:00:00+09:00`).getUTCDay();
}

/** FF는 thisweek만 제공 → 2주 뷰용 반복 매크로(목요일 실업수당 등) 보강 */
function generateRecurringMacro(start, endExclusive) {
  const events = [];
  let d = start;
  while (d < endExclusive) {
    if (kstDayOfWeek(d) === 4) {
      events.push({
        date: d,
        timeKst: '21:30',
        title: '미 신규 실업수당',
        category: '매크로',
        importance: 2,
        note: '주간 · BLS 8:30 ET',
        source: 'recurring',
      });
    }
    d = addDaysKst(d, 1);
  }
  return events;
}

async function fetchForexFactoryMacro(start, endExclusive) {
  try {
    const r = await withTimeout(
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
        headers: { ...UA, Accept: 'application/json' },
      }),
      6000,
    );
    if (!r.ok) return [];
    const rows = await r.json();
    if (!Array.isArray(rows)) return [];

    return rows
      .filter((row) => row.country === 'USD' && (row.impact === 'High' || row.impact === 'Medium'))
      .filter((row) => !/FOMC Member|BOJ|Tokyo Core|Common CPI|Median CPI|Trimmed CPI|Trimmed Mean/i.test(row.title))
      .map((row) => {
        const kst = unixToKst(Math.floor(new Date(row.date).getTime() / 1000));
        if (!kst.date || kst.date < start || kst.date >= endExclusive) return null;
        const importance = row.impact === 'High' ? 3 : 2;
        const title = /^CPI y\/y$/i.test(row.title)
          ? '미 CPI(소비자물가)'
          : /^Core CPI m\/m$/i.test(row.title)
            ? '미 Core CPI'
            : `미 ${row.title}`;
        const bits = [row.forecast ? `예상 ${row.forecast}` : null, row.previous ? `이전 ${row.previous}` : null]
          .filter(Boolean);
        return {
          date: kst.date,
          timeKst: kst.timeKst,
          title,
          category: '매크로',
          importance,
          note: bits.length ? bits.join(' · ') : 'Forex Factory',
          source: 'ff',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchAllEarnings(start, endExclusive) {
  let auth;
  try {
    auth = await withTimeout(yahooAuth(), 5000);
  } catch {
    return [];
  }

  const krTargets = mergeKrScanTargets();
  const wlUs = getMergedWatchlistUS();
  const labelBySym = Object.fromEntries(wlUs.map((x) => [x.sym, x.label]));
  const usSyms = [...new Set([...EARNINGS_SCAN_US, ...wlUs.map((x) => x.sym)])];

  const jobs = [
    ...usSyms.map((sym) => ({ sym, label: labelBySym[sym] || sym, market: 'us' })),
    ...krTargets.map((x) => ({ sym: `${x.code}.KS`, label: x.label, market: 'kr' })),
    ...krTargets.filter((x) => x.adr).map((x) => ({ sym: x.adr, label: x.label, market: 'us' })),
  ];

  const rows = await mapPool(jobs, YAHOO_POOL, (job) =>
    fetchYahooEarnings(job.sym, job.label, job.market, auth, start, endExclusive));

  return rows.filter((e) => e && e.date >= start && e.date < endExclusive);
}

async function fetchAllKrDisclosures(start, endExclusive) {
  const targets = mergeKrScanTargets();
  const batches = await mapPool(targets, 3, (t) =>
    fetchNaverKrDisclosures(t.code, t.label, start, endExclusive));
  return batches.flat();
}

async function buildEventsPayload() {
  const start = todayKstDateStr();
  const endExclusive = addDaysKst(start, EVENT_FETCH_DAYS);

  const [fred, ff, recurring, fomc, earnings, krDisclosures] = await Promise.all([
    fetchFredMacro(start, endExclusive),
    fetchForexFactoryMacro(start, endExclusive),
    Promise.resolve(generateRecurringMacro(start, endExclusive)),
    Promise.resolve(generateFomcEvents(start, endExclusive)),
    fetchAllEarnings(start, endExclusive),
    fetchAllKrDisclosures(start, endExclusive),
  ]);

  const events = sortEvents(
    dedupeEvents(
      filterEventsInRange([...fred, ...ff, ...recurring, ...fomc, ...earnings, ...krDisclosures], start, endExclusive),
    ),
  );

  return {
    events,
    range: { start, end: addDaysKst(start, EVENT_FETCH_DAYS - 1), days: EVENT_FETCH_DAYS },
    sources: ['FRED', 'Fed FOMC', 'Forex Factory', 'Yahoo Finance', 'Naver 공시'],
    fetchedAt: new Date().toISOString(),
  };
}

function parseViewDays(raw) {
  const n = Number(raw);
  if (n === 30) return 35;
  return EVENT_VIEW_OPTIONS.includes(n) ? n : 14;
}

function filterEventsByViewDays(payload, viewDays) {
  const start = payload.range.start;
  const endExclusive = addDaysKst(start, viewDays);
  return {
    ...payload,
    events: payload.events.filter((e) => e.date >= start && e.date < endExclusive),
    viewDays,
    viewRange: { start, end: addDaysKst(start, viewDays - 1), days: viewDays },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const viewDays = parseViewDays(req.query.days);

  if (cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
    return res.status(200).json({ ...filterEventsByViewDays(cache.payload, viewDays), cached: true });
  }

  try {
    const payload = await buildEventsPayload();
    cache = { at: Date.now(), payload };
    return res.status(200).json(filterEventsByViewDays(payload, viewDays));
  } catch (e) {
    return res.status(500).json({ error: e.message || '일정 조회 실패' });
  }
}

export const config = {
  maxDuration: 60,
};
