// pages/api/stock.js - Finnhub API 기반
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const KEY = process.env.FINNHUB_API_KEY;

  // Finnhub 심볼 매핑
  const symbols = [
    { key: 'nasdaq',    sym: 'IXIC',       type: 'index' },
    { key: 'sp500',     sym: 'SPX',        type: 'index' },
    { key: 'sox',       sym: 'SOX',        type: 'index' },
    { key: 'nvda',      sym: 'NVDA',       type: 'stock' },
    { key: 'samsung',   sym: 'KRX:005930', type: 'stock' },
    { key: 'hynix',     sym: 'KRX:000660', type: 'stock' },
    { key: 'nasdaqFut', sym: 'NQ1!',       type: 'future' },
    { key: 'wti',       sym: 'NYMEX:CL1!', type: 'future' },
    { key: 'vix',       sym: 'VIX',        type: 'index' },
    { key: 'usdkrw',    sym: 'OANDA:USD_KRW', type: 'forex' },
  ];

  async function getQuote(sym) {
    try {
      const r = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`
      );
      if (!r.ok) return null;
      const d = await r.json();
      if (!d.c || d.c === 0) return null;
      return {
        price: d.c,
        chg: d.dp, // percent change
      };
    } catch { return null; }
  }

  try {
    // 병렬 호출
    const results = await Promise.all(symbols.map(s => getQuote(s.sym)));

    const out = {};
    symbols.forEach((s, i) => {
      const r = results[i];
      out[s.key] = r?.price ?? null;
      out[s.key + 'Chg'] = r?.chg ?? null;
    });

    // 선물/지수 없는 것 null 처리
    out.kospiFut = null;
    out.kospiFutChg = null;

    res.status(200).json(out);
  } catch (error) {
    console.error('Stock API Error:', error);
    res.status(200).json({ error: error.message });
  }
}