// pages/api/stock.js
// 개별 주식(NVDA, 삼성, 하이닉스) → Finnhub
// 지수/ETF/환율 → Alpha Vantage

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const AV_KEY = process.env.ALPHAVANTAGE_API_KEY;
  const FH_KEY = process.env.FINNHUB_API_KEY;

  // Alpha Vantage: GLOBAL_QUOTE
  async function av(sym) {
    try {
      const r = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${AV_KEY}`
      );
      const d = await r.json();
      const q = d['Global Quote'];
      if (!q || !q['05. price']) return null;
      return {
        price: parseFloat(q['05. price']),
        chg:   parseFloat(q['10. change percent'].replace('%', '')),
      };
    } catch { return null; }
  }

  // Finnhub: 개별 주식
  async function fh(sym) {
    try {
      const r = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FH_KEY}`
      );
      const d = await r.json();
      if (!d.c || d.c === 0) return null;
      return { price: d.c, chg: d.dp };
    } catch { return null; }
  }

  try {
    // Alpha Vantage로 지수/ETF 조회
    // QQQ=나스닥100, SPY=S&P500, SOXX=필반, UVXY=VIX 대용, USO=WTI 대용
    const [qqq, spy, soxx, nvda, samsung, hynix, usdkrw] = await Promise.all([
      av('QQQ'),        // 나스닥100 ETF
      av('SPY'),        // S&P500 ETF  
      av('SOXX'),       // 필라델피아 반도체 ETF
      fh('NVDA'),       // 엔비디아
      fh('KRX:005930'), // 삼성전자
      fh('KRX:000660'), // SK하이닉스
      av('USDKRW'),     // 달러원 환율
    ]);

    // WTI, VIX는 별도 AV 호출 (rate limit 고려해 순차)
    const wti = await av('USO');  // WTI ETF 대용
    const vix = await av('VIXY'); // VIX ETF 대용

    res.status(200).json({
      nasdaq:       qqq?.price   ?? null,
      nasdaqChg:    qqq?.chg     ?? null,
      nasdaqFut:    qqq?.price   ?? null,
      nasdaqFutChg: qqq?.chg     ?? null,
      sp500:        spy?.price   ?? null,
      sp500Chg:     spy?.chg     ?? null,
      sox:          soxx?.price  ?? null,
      soxChg:       soxx?.chg    ?? null,
      nvda:         nvda?.price  ?? null,
      nvdaChg:      nvda?.chg    ?? null,
      samsung:      samsung?.price ?? null,
      samsungChg:   samsung?.chg   ?? null,
      hynix:        hynix?.price ?? null,
      hynixChg:     hynix?.chg   ?? null,
      usdkrw:       usdkrw?.price ?? null,
      usdkrwChg:    usdkrw?.chg   ?? null,
      wti:          wti?.price   ?? null,
      wtiChg:       wti?.chg     ?? null,
      vix:          vix?.price   ?? null,
      vixChg:       vix?.chg     ?? null,
      kospiFut:     null,
      kospiFutChg:  null,
    });
  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({ error: error.message });
  }
}