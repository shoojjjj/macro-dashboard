// pages/api/stock.js
// 주식(NVDA, 삼성, 하이닉스) → Finnhub
// 지수/선물/환율/원자재 → stooq.com (무료, 키 불필요)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

  // ── Finnhub: 개별 주식 ──
  async function finnhub(sym) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
      const d = await r.json();
      if (!d.c || d.c === 0) return null;
      return { price: d.c, chg: d.dp };
    } catch { return null; }
  }

  // ── stooq: 지수/선물/환율 ──
  // stooq CSV: Date,Open,High,Low,Close,Volume
  async function stooq(sym) {
    try {
      const r = await fetch(`https://stooq.com/q/d/l/?s=${sym}&i=d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const text = await r.text();
      const lines = text.trim().split('\n');
      if (lines.length < 3) return null;

      // 최신 2개 행으로 등락률 계산
      const last  = lines[lines.length - 1].split(',');
      const prev  = lines[lines.length - 2].split(',');
      const price = parseFloat(last[4]);  // Close
      const prevP = parseFloat(prev[4]);
      if (!price || !prevP) return null;
      const chg = ((price - prevP) / prevP) * 100;
      return { price, chg };
    } catch { return null; }
  }

  // stooq 심볼 매핑
  // ^ixic=나스닥, ^spx=S&P500, ^sox=필반, ^vix=VIX
  // nq.f=나스닥선물, cl.f=WTI, usdkrw=달러원

  try {
    const [nvda, samsung, hynix, nasdaq, sp500, sox, vix, nasdaqFut, wti, usdkrw] = await Promise.all([
      finnhub('NVDA'),
      finnhub('KRX:005930'),
      finnhub('KRX:000660'),
      stooq('^ixic'),
      stooq('^spx'),
      stooq('^sox'),
      stooq('^vix'),
      stooq('nq.f'),
      stooq('cl.f'),
      stooq('usdkrw'),
    ]);

    res.status(200).json({
      nvda:         nvda?.price   ?? null,
      nvdaChg:      nvda?.chg     ?? null,
      samsung:      samsung?.price ?? null,
      samsungChg:   samsung?.chg   ?? null,
      hynix:        hynix?.price  ?? null,
      hynixChg:     hynix?.chg    ?? null,
      nasdaq:       nasdaq?.price  ?? null,
      nasdaqChg:    nasdaq?.chg    ?? null,
      sp500:        sp500?.price   ?? null,
      sp500Chg:     sp500?.chg     ?? null,
      sox:          sox?.price     ?? null,
      soxChg:       sox?.chg       ?? null,
      vix:          vix?.price     ?? null,
      vixChg:       vix?.chg       ?? null,
      nasdaqFut:    nasdaqFut?.price ?? null,
      nasdaqFutChg: nasdaqFut?.chg   ?? null,
      wti:          wti?.price     ?? null,
      wtiChg:       wti?.chg       ?? null,
      usdkrw:       usdkrw?.price  ?? null,
      usdkrwChg:    usdkrw?.chg    ?? null,
      kospiFut:     null,
      kospiFutChg:  null,
    });
  } catch (error) {
    console.error('Stock API Error:', error.message);
    res.status(200).json({ error: error.message });
  }
}