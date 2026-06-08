// pages/api/stock.js
// yahoo-finance2 패키지 사용 — 서버사이드에서 쿠키/헤더 자동 처리
// Vercel Edge에서 IP 차단 우회 가능

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const yahooFinance = (await import('yahoo-finance2')).default;

    // 히트맵 포함 전체 심볼 한 번에
    const symbols = [
      // 메인 지수/ETF
      'QQQ', 'SPY', 'SOXX', '^VIX', 'NQ=F', 'CL=F', 'USDKRW=X',
      // 개별 주식
      'NVDA', '005930.KS', '000660.KS',
      // 미국 히트맵
      'AVGO', 'AMD', 'QCOM', 'MU', 'INTC',
      'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA',
      'JPM', 'V', 'BAC', 'GS',
      'BRK-B', 'WMT', 'UNH', 'XOM',
      // 한국 히트맵
      '000270.KS', '005380.KS', '035420.KS', '051910.KS',
      '006400.KS', '003670.KS', '028260.KS', '035720.KS',
      '096770.KS', '066570.KS',
    ];

    const results = await yahooFinance.quote(symbols, {
      fields: ['regularMarketPrice', 'regularMarketChangePercent'],
    });

    const arr = Array.isArray(results) ? results : [results];
    const map = {};
    arr.forEach(r => {
      if (r?.symbol) {
        map[r.symbol] = {
          price: r.regularMarketPrice ?? null,
          chg: r.regularMarketChangePercent ?? null,
        };
      }
    });

    const g = (sym) => map[sym] ?? { price: null, chg: null };

    res.status(200).json({
      // 메인 티커
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
      // 히트맵 전체
      heatmap: map,
    });

  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({
      error: error.message,
      nasdaq: null, nasdaqChg: null, sp500: null, sp500Chg: null,
      sox: null, soxChg: null, nvda: null, nvdaChg: null,
      samsung: null, samsungChg: null, hynix: null, hynixChg: null,
      wti: null, wtiChg: null, usdkrw: null, usdkrwChg: null,
      vix: null, vixChg: null, nasdaqFut: null, nasdaqFutChg: null,
      kospiFut: null, kospiFutChg: null,
      heatmap: {},
    });
  }
}