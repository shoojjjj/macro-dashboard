export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  const symbols = [
    'QQQ','SPY','SOXX','^VIX','NQ=F','CL=F','USDKRW=X',
    'NVDA','005930.KS','000660.KS',
    'AVGO','AMD','QCOM','MU','INTC',
    'AAPL','MSFT','AMZN','GOOGL','META','TSLA',
    'JPM','V','BAC','GS',
    'BRK-B','WMT','UNH','XOM',
    '000270.KS','005380.KS','035420.KS','051910.KS',
    '006400.KS','003670.KS','028260.KS','035720.KS',
    '096770.KS','066570.KS',
  ];

  try {
    // CJS require로 로드
    const yf = require('yahoo-finance2');
    const quoteFn = yf.default?.quote ?? yf.quote;
    
    const results = await quoteFn.call(yf.default ?? yf, symbols);
    const arr = Array.isArray(results) ? results : [results];
    
    const map = {};
    arr.forEach(r => {
      if (r?.symbol) map[r.symbol] = {
        price: r.regularMarketPrice ?? null,
        chg: r.regularMarketChangePercent ?? null,
      };
    });

    const g = (sym) => map[sym] ?? { price: null, chg: null };

    res.status(200).json({
      nasdaq: g('QQQ').price, nasdaqChg: g('QQQ').chg,
      nasdaqFut: g('NQ=F').price, nasdaqFutChg: g('NQ=F').chg,
      sp500: g('SPY').price, sp500Chg: g('SPY').chg,
      sox: g('SOXX').price, soxChg: g('SOXX').chg,
      nvda: g('NVDA').price, nvdaChg: g('NVDA').chg,
      samsung: g('005930.KS').price, samsungChg: g('005930.KS').chg,
      hynix: g('000660.KS').price, hynixChg: g('000660.KS').chg,
      wti: g('CL=F').price, wtiChg: g('CL=F').chg,
      usdkrw: g('USDKRW=X').price, usdkrwChg: g('USDKRW=X').chg,
      vix: g('^VIX').price, vixChg: g('^VIX').chg,
      kospiFut: null, kospiFutChg: null,
      heatmap: map,
    });
  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({ error: error.message, heatmap: {} });
  }
}