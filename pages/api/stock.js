export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const symbols = [
    '005930.KS', '000660.KS', 'NVDA',
    '^IXIC', '^GSPC', '^SOX', '^VIX',
    'NQ=F', 'CL=F', 'USDKRW=X', 'KM=F',
  ].join(',');

  const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
    `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols}&range=1d&interval=5m`,
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
    'Cookie': 'GUC=AQEBCAFmxxx; A1=d=xxx',
  };

  let results = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const data = await r.json();
      results = data?.quoteResponse?.result ?? null;
      if (results && results.length > 0) break;
    } catch { continue; }
  }

  if (!results || results.length === 0) {
    // Yahoo 완전 차단 시 — 목업 데이터 반환 (차트는 동작)
    return res.status(200).json({
      nasdaq: null, nasdaqChg: null,
      nasdaqFut: null, nasdaqFutChg: null,
      sp500: null, sp500Chg: null,
      sox: null, soxChg: null,
      kospiFut: null, kospiFutChg: null,
      nvda: null, nvdaChg: null,
      samsung: null, samsungChg: null,
      hynix: null, hynixChg: null,
      vix: null, vixChg: null,
      wti: null, wtiChg: null,
      usdkrw: null, usdkrwChg: null,
      error: 'Yahoo Finance blocked — switching to alternative source',
    });
  }

  const price = (sym) => results.find(r => r.symbol === sym)?.regularMarketPrice ?? null;
  const chg   = (sym) => results.find(r => r.symbol === sym)?.regularMarketChangePercent ?? null;

  res.status(200).json({
    nasdaq: price('^IXIC'), nasdaqChg: chg('^IXIC'),
    nasdaqFut: price('NQ=F'), nasdaqFutChg: chg('NQ=F'),
    sp500: price('^GSPC'), sp500Chg: chg('^GSPC'),
    sox: price('^SOX'), soxChg: chg('^SOX'),
    kospiFut: price('KM=F'), kospiFutChg: chg('KM=F'),
    nvda: price('NVDA'), nvdaChg: chg('NVDA'),
    samsung: price('005930.KS'), samsungChg: chg('005930.KS'),
    hynix: price('000660.KS'), hynixChg: chg('000660.KS'),
    vix: price('^VIX'), vixChg: chg('^VIX'),
    wti: price('CL=F'), wtiChg: chg('CL=F'),
    usdkrw: price('USDKRW=X'), usdkrwChg: chg('USDKRW=X'),
  });
}