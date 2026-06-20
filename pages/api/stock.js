// 서버사이드 프록시: 네이버(한국) + Yahoo(미국)
// 브라우저 CORS 문제 우회 — 서버에서 호출 후 JSON으로 반환

const US_SYMBOLS = [
  'QQQ','SPY','SOXX','%5EVIX','NQ=F','CL=F','USDKRW=X','NVDA',
  'AVGO','AMD','QCOM','MU','INTC',
  'AAPL','MSFT','AMZN','GOOGL','META','TSLA',
  'JPM','V','BAC','GS',
  'BRK-B','WMT','UNH','XOM',
];

const KR_CODES = [
  '005930','000660','005380','000270','035420','051910',
  '006400','003670','028260','035720','096770','066570',
];

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

async function fetchNaver(code) {
  try {
    const r = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`);
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

async function fetchKospiNightFutures() {
  try {
    // 네이버 코스피200 야간선물 (KRX 야간 선물 코드: 101S)
    const r = await fetch('https://polling.finance.naver.com/api/realtime/worldstock/index/FUT.NG.KS200');
    if (!r.ok) return null;
    const d = await r.json();
    const item = d?.datas?.[0];
    if (!item) return null;
    return {
      price: parseFloat(String(item.closePrice ?? item.closePriceRaw ?? '').replace(/,/g,'')),
      chg: parseFloat(item.fluctuationsRatio ?? item.fluctuationsRatioRaw),
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  try {
    const usResults = await Promise.all(US_SYMBOLS.map(fetchYahoo));
    const usMap = {};
    US_SYMBOLS.forEach((sym, i) => { usMap[sym] = usResults[i]; });

    const krResults = await Promise.all(KR_CODES.map(fetchNaver));
    const krMap = {};
    KR_CODES.forEach((code, i) => { krMap[code] = krResults[i]; });

    const kospiFut = await fetchKospiNightFutures();

    const g = (sym) => usMap[sym] ?? { price: null, chg: null };

    res.status(200).json({
      nasdaq: g('QQQ').price, nasdaqChg: g('QQQ').chg,
      nasdaqFut: g('NQ=F').price, nasdaqFutChg: g('NQ=F').chg,
      sp500: g('SPY').price, sp500Chg: g('SPY').chg,
      sox: g('SOXX').price, soxChg: g('SOXX').chg,
      nvda: g('NVDA').price, nvdaChg: g('NVDA').chg,
      samsung: krMap['005930']?.price, samsungChg: krMap['005930']?.chg,
      hynix: krMap['000660']?.price, hynixChg: krMap['000660']?.chg,
      wti: g('CL=F').price, wtiChg: g('CL=F').chg,
      usdkrw: g('USDKRW=X').price, usdkrwChg: g('USDKRW=X').chg,
      vix: g('%5EVIX').price, vixChg: g('%5EVIX').chg,
      kospiFut: kospiFut?.price ?? null, kospiFutChg: kospiFut?.chg ?? null,
      heatUS: usMap,
      heatKR: krMap,
    });
  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({ error: error.message, heatUS: {}, heatKR: {} });
  }
}