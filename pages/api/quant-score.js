import { EMPTY_METRICS, round3, defaultMetricSources } from '../../lib/quantScore';
import { resolveStockQuery } from '../../lib/symbolResolver';

const UA = { 'User-Agent': 'Mozilla/5.0' };
const NAVER = { ...UA, Accept: 'application/json' };

/** 국내 주요 종목 ADR — forward 지표 보조 (Yahoo .KS 재무는 사용 안 함) */
const KR_ADR = {
  '005930': 'SSNLF',
  '000660': 'HXSCL',
  '035420': 'NHNCF',
};

async function yahooAuth() {
  const r1 = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const crumb = await (await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: cookie } })).text();
  return { cookie, crumb };
}

async function yahooQuoteSummary(yahooSym) {
  try {
    const { cookie, crumb } = await yahooAuth();
    const modules = 'financialData,defaultKeyStatistics,earningsTrend,incomeStatementHistory';
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSym)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
    const r = await fetch(url, { headers: { ...UA, Cookie: cookie } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.quoteSummary?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

async function yahooChart(yahooSym, range = '1y') {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=${range}`, { headers: UA });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcReturn(closes, days) {
  if (closes.length < days + 1) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - days];
  if (!prev) return null;
  return ((last - prev) / prev) * 100;
}

async function fetchMomentum(yahooCandidates) {
  let chart = null;
  let yahooSym = null;
  for (const sym of yahooCandidates) {
    chart = await yahooChart(sym, '1y');
    if (chart?.indicators?.quote?.[0]?.close?.filter(Boolean).length > 50) {
      yahooSym = sym;
      break;
    }
  }
  if (!chart) return { ...EMPTY_METRICS, yahooSym: null };

  const closes = chart.indicators.quote[0].close.filter((v) => v != null);
  const price = chart.meta?.regularMarketPrice ?? closes[closes.length - 1];
  const high52 = chart.meta?.fiftyTwoWeekHigh ?? Math.max(...closes);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const maAligned = ma20 != null && ma50 != null && ma200 != null && price > ma20 && ma20 > ma50 && ma50 > ma200;
  const drawdownFrom52wHigh = high52 ? ((price - high52) / high52) * 100 : null;
  const return3mo = calcReturn(closes, 63);

  const spyChart = await yahooChart('SPY', '1y');
  const spyCloses = spyChart?.indicators?.quote?.[0]?.close?.filter((v) => v != null) ?? [];
  const sp500Return3mo = calcReturn(spyCloses, 63);

  return { maAligned, drawdownFrom52wHigh, return3mo, sp500Return3mo, yahooSym, price, high52 };
}

function parseNum(str) {
  if (str == null || str === '-' || str === '') return null;
  const n = parseFloat(String(str).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowValue(rowList, title, key) {
  const row = rowList?.find((r) => r.title === title);
  return parseNum(row?.columns?.[key]?.value);
}

function latestActualKey(trTitleList) {
  const actual = trTitleList?.filter((t) => t.isConsensus === 'N') ?? [];
  return actual.length ? actual[actual.length - 1].key : trTitleList?.[trTitleList.length - 2]?.key;
}

function prevActualKey(trTitleList) {
  const actual = trTitleList?.filter((t) => t.isConsensus === 'N') ?? [];
  if (actual.length >= 2) return actual[actual.length - 2].key;
  return null;
}

function titleByKey(trTitleList, key) {
  return trTitleList?.find((t) => t.key === key)?.title ?? null;
}

function fyShort(title) {
  const m = String(title || '').match(/(\d{4})/);
  return m ? m[1].slice(2) : '?';
}

function periodArrow(fromTitle, toTitle, suffix = '') {
  if (!fromTitle || !toTitle) return null;
  return `${fyShort(fromTitle)}>${fyShort(toTitle)}${suffix}`;
}

function quarterPeriodLabel(title) {
  const m = String(title || '').match(/(\d{4})\.(\d{2})/);
  if (!m) return fyShort(title);
  const q = Math.ceil(parseInt(m[2], 10) / 3);
  return `${m[1].slice(2)}Q${q}`;
}

function sameQuarterPrevYearKey(trTitleList, latestKey) {
  const latest = trTitleList?.find((t) => t.key === latestKey);
  if (!latest) return null;
  const m = latest.title.match(/(\d{4})\.(\d{2})/);
  if (!m) return null;
  const target = `${Number(m[1]) - 1}.${m[2]}.`;
  return trTitleList.find((t) => t.title === target && t.isConsensus === 'N')?.key ?? null;
}

function annualEpsGrowthFromFinance(fin) {
  const epsRow = fin?.rowList?.find((r) => r.title === 'EPS');
  const titles = fin?.trTitleList ?? [];
  const actual = titles.filter((t) => t.isConsensus === 'N');
  const consensus = titles.find((t) => t.isConsensus === 'Y');
  if (!epsRow || !consensus || !actual.length) return null;

  const lastActual = actual[actual.length - 1];
  const aEps = parseNum(epsRow.columns?.[lastActual.key]?.value);
  const cEps = parseNum(epsRow.columns?.[consensus.key]?.value);
  if (aEps == null || cEps == null || aEps === 0) return null;
  return {
    value: ((cEps - aEps) / Math.abs(aEps)) * 100,
    period: periodArrow(lastActual.title, consensus.title, '컨센'),
    fromTitle: lastActual.title,
    toTitle: consensus.title,
  };
}

function computePeg(fPER, epsGrowth) {
  if (fPER == null || epsGrowth == null || epsGrowth === 0) return null;
  return fPER / epsGrowth;
}

/** 국장: 네이버 우선 · ADR forward만 보조 · .KS 재무 병합 금지 */
function mergeKrMetrics(naver, adrMetrics) {
  const out = { ...naver };
  if (!adrMetrics) return out;
  if (out.fPER == null && adrMetrics.fPER != null) out.fPER = adrMetrics.fPER;
  if (out.epsGrowthNextYear == null && adrMetrics.epsGrowthNextYear != null) {
    out.epsGrowthNextYear = adrMetrics.epsGrowthNextYear;
  }
  out.peg = computePeg(out.fPER, out.epsGrowthNextYear) ?? out.peg;
  return out;
}

async function fetchNaverMetrics(code) {
  const metrics = { ...EMPTY_METRICS };
  const metricPeriods = {};
  const sources = [];

  const [integration, summary, annual, quarter] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers: NAVER }).then((r) => r.json()).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/summary`, { headers: NAVER }).then((r) => r.json()).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/annual`, { headers: NAVER }).then((r) => r.json()).catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${code}/finance/quarter`, { headers: NAVER }).then((r) => r.json()).catch(() => null),
  ]);

  const stockName = integration?.stockName ?? code;
  const infos = integration?.totalInfos ?? [];
  const infoMap = Object.fromEntries(infos.map((x) => [x.code, x.value]));

  metrics.fPER = parseNum(infoMap.cnsPer);
  if (metrics.fPER != null) {
    sources.push('네이버 추정PER');
    metricPeriods.fPER = 'Forward · 네이버 컨센';
  }

  const fin = annual?.financeInfo;
  const qfin = quarter?.financeInfo;
  const latestKey = latestActualKey(fin?.trTitleList);
  const prevKey = prevActualKey(fin?.trTitleList);
  const latestQKey = latestActualKey(qfin?.trTitleList);
  const prevQKey = prevActualKey(qfin?.trTitleList);
  const prevYearQKey = latestQKey ? sameQuarterPrevYearKey(qfin?.trTitleList, latestQKey) : null;

  if (latestQKey && prevQKey) {
    const qRevNow = rowValue(qfin.rowList, '매출액', latestQKey);
    const qRevPrev = rowValue(qfin.rowList, '매출액', prevQKey);
    if (qRevNow != null && qRevPrev) {
      metrics.revenueQoQ = ((qRevNow - qRevPrev) / qRevPrev) * 100;
      metricPeriods.revenueQoQ = `${quarterPeriodLabel(titleByKey(qfin.trTitleList, prevQKey))}>${quarterPeriodLabel(titleByKey(qfin.trTitleList, latestQKey))}`;
      sources.push('네이버 분기 매출 QoQ');
    }
  }

  if (latestKey && prevKey) {
    const revNow = rowValue(fin.rowList, '매출액', latestKey);
    const revPrev = rowValue(fin.rowList, '매출액', prevKey);
    if (revNow != null && revPrev) {
      metrics.revenueYoY = ((revNow - revPrev) / revPrev) * 100;
      metricPeriods.revenueYoY = periodArrow(titleByKey(fin.trTitleList, prevKey), titleByKey(fin.trTitleList, latestKey));
      sources.push('네이버 연간 매출');
    }
  }

  if (latestQKey && prevYearQKey) {
    const qRevNow = rowValue(qfin.rowList, '매출액', latestQKey);
    const qRevPrev = rowValue(qfin.rowList, '매출액', prevYearQKey);
    if (qRevNow != null && qRevPrev) {
      metrics.revenueYoYQuarter = ((qRevNow - qRevPrev) / qRevPrev) * 100;
      metricPeriods.revenueYoYQuarter = `${quarterPeriodLabel(titleByKey(qfin.trTitleList, prevYearQKey))}>${quarterPeriodLabel(titleByKey(qfin.trTitleList, latestQKey))}`;
      sources.push('네이버 분기 매출 YoY');
    }
  }

  const opmTitle = titleByKey(fin?.trTitleList, latestKey) ?? titleByKey(qfin?.trTitleList, latestQKey);
  metrics.opm = rowValue(fin?.rowList, '영업이익률', latestKey) ?? rowValue(qfin?.rowList, '영업이익률', latestQKey);
  if (metrics.opm != null) {
    sources.push('네이버 영업이익률');
    if (opmTitle) metricPeriods.opm = `${fyShort(opmTitle)} 실적`;
  }

  metrics.debtRatio = rowValue(fin?.rowList, '부채비율', latestKey) ?? rowValue(qfin?.rowList, '부채비율', latestQKey);
  let liq = rowValue(fin?.rowList, '당좌비율', latestKey) ?? rowValue(qfin?.rowList, '당좌비율', latestQKey);
  if (liq != null && liq > 10) liq = liq / 100;
  metrics.currentRatio = liq;
  if (metrics.currentRatio != null) sources.push('네이버 당좌비율→유동 대체');

  const annualEpsGrowth = annualEpsGrowthFromFinance(fin);
  if (annualEpsGrowth != null) {
    metrics.epsGrowthNextYear = annualEpsGrowth.value;
    metricPeriods.epsGrowthNextYear = annualEpsGrowth.period;
    sources.push('네이버 연간 EPS 컨센서스');
  } else if (summary?.chartEps?.columns?.[1]) {
    const epsCols = summary.chartEps.columns[1];
    const actualIdx = summary.chartEps.trTitleList?.map((t, i) => ({ ...t, idx: i + 1 })).filter((t) => t.isConsensus === 'N') ?? [];
    const consensus = summary.chartEps.trTitleList?.find((t) => t.isConsensus === 'Y');
    const lastActual = actualIdx[actualIdx.length - 1];
    if (consensus && lastActual) {
      const cIdx = summary.chartEps.trTitleList.findIndex((t) => t.key === consensus.key) + 1;
      const cEps = parseNum(epsCols[cIdx]);
      const aEps = parseNum(epsCols[lastActual.idx]);
      if (cEps != null && aEps) {
        metrics.epsGrowthNextYear = ((cEps - aEps) / Math.abs(aEps)) * 100;
        metricPeriods.epsGrowthNextYear = periodArrow(lastActual.title, consensus.title, '컨센');
        sources.push('네이버 EPS 차트');
      }
    }
  }

  metrics.peg = computePeg(metrics.fPER, metrics.epsGrowthNextYear);
  if (metrics.peg != null) sources.push('PEG 계산 · fPER÷EPS성장');

  const metricSources = defaultMetricSources('kr');
  return { metrics, stockName, sources: [...new Set(sources)], metricSources, metricPeriods };
}

async function fetchAdrForwardMetrics(adrSym) {
  if (!adrSym) return { metrics: {}, sources: [], adrSym: null };
  const summary = await yahooQuoteSummary(adrSym);
  if (!summary) return { metrics: {}, sources: [], adrSym: null };

  const metrics = {};
  const fd = summary.financialData ?? {};
  const dk = summary.defaultKeyStatistics ?? {};
  const trend = summary.earningsTrend?.trend ?? [];
  const nextYear = trend.find((t) => t.period === '+1y');

  metrics.fPER = fd.forwardPE?.raw ?? dk.forwardPE?.raw ?? null;
  if (nextYear?.growth?.raw != null) metrics.epsGrowthNextYear = nextYear.growth.raw * 100;
  else if (fd.earningsGrowth?.raw != null) metrics.epsGrowthNextYear = fd.earningsGrowth.raw * 100;
  metrics.peg = dk.pegRatio?.raw ?? computePeg(metrics.fPER, metrics.epsGrowthNextYear);

  return {
    metrics,
    sources: metrics.fPER != null || metrics.epsGrowthNextYear != null ? [`Yahoo ADR ${adrSym}`] : [],
    adrSym,
  };
}

async function fetchUsMetrics(yahooCandidates) {
  const metrics = { ...EMPTY_METRICS };
  const sources = [];
  let summary = null;
  let yahooSym = null;

  for (const sym of yahooCandidates) {
    const hit = await yahooQuoteSummary(sym);
    if (!hit) continue;
    summary = hit;
    yahooSym = sym;
    if (hit.financialData) break;
  }

  if (!summary) {
    return {
      metrics,
      stockName: yahooCandidates[0],
      sources,
      yahooSym: null,
      metricSources: defaultMetricSources('us'),
      metricPeriods: {},
    };
  }

  const fd = summary.financialData;
  const dk = summary.defaultKeyStatistics ?? {};
  const trend = summary.earningsTrend?.trend ?? [];
  const nextYear = trend.find((t) => t.period === '+1y');

  if (fd) {
    if (fd.revenueGrowth?.raw != null) metrics.revenueYoY = fd.revenueGrowth.raw * 100;
    if (nextYear?.growth?.raw != null) metrics.epsGrowthNextYear = nextYear.growth.raw * 100;
    else if (fd.earningsGrowth?.raw != null) metrics.epsGrowthNextYear = fd.earningsGrowth.raw * 100;

    if (fd.operatingMargins?.raw != null) metrics.opm = fd.operatingMargins.raw * 100;

    if (fd.operatingCashflow?.raw != null && fd.totalRevenue?.raw != null && fd.operatingMargins?.raw != null) {
      const oi = fd.totalRevenue.raw * fd.operatingMargins.raw;
      if (oi > 0) metrics.cashConversion = (fd.operatingCashflow.raw / oi) * 100;
    }

    metrics.fPER = fd.forwardPE?.raw ?? null;
    metrics.debtRatio = fd.debtToEquity?.raw ?? null;
    metrics.currentRatio = fd.currentRatio?.raw ?? null;
  }

  if (metrics.fPER == null) metrics.fPER = dk.forwardPE?.raw ?? null;
  metrics.peg = dk.pegRatio?.raw ?? computePeg(metrics.fPER, metrics.epsGrowthNextYear);
  if (metrics.peg == null && metrics.fPER != null && metrics.epsGrowthNextYear != null) {
    metrics.peg = computePeg(metrics.fPER, metrics.epsGrowthNextYear);
  }

  if (fd || Object.keys(dk).length > 1) sources.push('Yahoo Finance');

  return {
    metrics,
    stockName: yahooSym,
    sources,
    yahooSym,
    metricSources: defaultMetricSources('us'),
    metricPeriods: {
      revenueYoY: 'TTM · Yahoo',
      epsGrowthNextYear: 'Forward +1y · Yahoo',
      opm: 'TTM · Yahoo',
      cashConversion: 'TTM · Yahoo',
      fPER: 'Forward · Yahoo',
    },
  };
}

function round3Metrics(m) {
  const out = { ...m };
  Object.keys(out).forEach((k) => {
    if (k === 'maAligned') return;
    if (out[k] != null && Number.isFinite(out[k])) out[k] = round3(out[k]);
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, dropdown } = req.body ?? {};
    const resolved = resolveStockQuery(query, dropdown);
    if (!resolved) {
      return res.status(400).json({ error: '종목을 찾을 수 없습니다. 티커·코드·한글명을 확인해주세요.' });
    }

    let base = { metrics: { ...EMPTY_METRICS }, stockName: resolved.label, sources: [], yahooSym: null, metricPeriods: {} };

    if (resolved.market === 'kr') {
      const naver = await fetchNaverMetrics(resolved.code);
      const adrSym = KR_ADR[resolved.code] ?? null;
      const adr = await fetchAdrForwardMetrics(adrSym);
      const merged = mergeKrMetrics(naver.metrics, adr.metrics);
      if (adr.metrics.fPER != null && naver.metrics.fPER == null) {
        naver.metricPeriods.fPER = `Forward · ADR ${adrSym}`;
      }
      if (adr.metrics.epsGrowthNextYear != null && naver.metrics.epsGrowthNextYear == null) {
        naver.metricPeriods.epsGrowthNextYear = 'Forward +1y · ADR';
      }
      base = {
        ...naver,
        metrics: merged,
        sources: [...new Set([...naver.sources, ...adr.sources])],
        yahooSym: null,
      };
    } else {
      base = await fetchUsMetrics(resolved.yahooCandidates);
    }

    const momentum = await fetchMomentum(resolved.yahooCandidates);
    const metrics = round3Metrics({
      ...base.metrics,
      maAligned: momentum.maAligned,
      drawdownFrom52wHigh: momentum.drawdownFrom52wHigh,
      return3mo: momentum.return3mo,
      sp500Return3mo: momentum.sp500Return3mo,
    });

    if (momentum.yahooSym) base.sources.push(`Yahoo Chart ${momentum.yahooSym}`);

    const metricPeriods = {
      ...(base.metricPeriods || {}),
      return3mo: '63거래일',
      sp500Return3mo: 'SPY 63거래일',
      drawdownFrom52wHigh: '52주 고점',
      maAligned: '20>50>200일선',
    };

    const metricSources = base.metricSources || defaultMetricSources(resolved.market);
    metricSources.maAligned = 'Yahoo Chart · 20>50>200일선';
    metricSources.drawdownFrom52wHigh = 'Yahoo Chart · 52주 고점 대비';
    metricSources.return3mo = 'Yahoo Chart · 63거래일 수익률';
    metricSources.sp500Return3mo = 'Yahoo Chart · SPY 3M';
    if (resolved.market === 'kr' && metrics.revenueYoYQuarter != null) {
      metricSources.revenueYoYQuarter = '네이버 · 분기 전년동기 · 성장 가중 45%';
    }
    if (resolved.market === 'kr' && metrics.revenueQoQ != null) {
      metricSources.revenueQoQ = '네이버 · 전분기 대비 · 성장 가중 40%';
    }
    if (resolved.market === 'kr') {
      metricSources.revenueYoY = '네이버 · 연간 실적 · 성장 가중 15%';
    }

    return res.status(200).json({
      resolved: {
        market: resolved.market,
        label: base.stockName || resolved.label,
        code: resolved.code ?? null,
        sym: resolved.sym ?? null,
      },
      metrics,
      metricSources,
      metricPeriods,
      sources: [...new Set(base.sources)],
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('quant-score error', e);
    return res.status(500).json({ error: e.message || '퀀트 데이터 조회 실패' });
  }
}
