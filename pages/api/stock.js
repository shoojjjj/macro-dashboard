// pages/api/stock.js
// 야후 파이낸스에서 주식/지수/선물/환율/원자재 실시간 데이터 조회

export default async function handler(req, res) {
  // 캐시 5분
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const symbols = [
    '005930.KS',   // 삼성전자
    '000660.KS',   // SK하이닉스
    'NVDA',        // 엔비디아
    '^IXIC',       // 나스닥 종합
    '^GSPC',       // S&P 500
    '^SOX',        // 필라델피아 반도체
    '^VIX',        // VIX 공포지수
    'NQ=F',        // 나스닥 100 선물
    'KM=F',        // KOSPI200 선물 (야간)
    'CL=F',        // WTI 원유 선물
    'USDKRW=X',    // 달러/원 환율
  ].join(',');

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) throw new Error(`Yahoo API Error: ${response.status}`);

    const data = await response.json();
    const results = data?.quoteResponse?.result ?? [];

    const get = (sym) => results.find(r => r.symbol === sym);
    const price = (sym) => get(sym)?.regularMarketPrice ?? null;
    const chg = (sym) => get(sym)?.regularMarketChangePercent ?? null;

    res.status(200).json({
      samsung:       price('005930.KS'),
      samsungChg:    chg('005930.KS'),
      hynix:         price('000660.KS'),
      hynixChg:      chg('000660.KS'),
      nvda:          price('NVDA'),
      nvdaChg:       chg('NVDA'),
      nasdaq:        price('^IXIC'),
      nasdaqChg:     chg('^IXIC'),
      sp500:         price('^GSPC'),
      sp500Chg:      chg('^GSPC'),
      sox:           price('^SOX'),
      soxChg:        chg('^SOX'),
      vix:           price('^VIX'),
      vixChg:        chg('^VIX'),
      nasdaqFut:     price('NQ=F'),
      nasdaqFutChg:  chg('NQ=F'),
      kospiFut:      price('KM=F'),
      kospiFutChg:   chg('KM=F'),
      wti:           price('CL=F'),
      wtiChg:        chg('CL=F'),
      usdkrw:        price('USDKRW=X'),
      usdkrwChg:     chg('USDKRW=X'),
      updatedAt:     new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stock API Error:', error);
    res.status(200).json({
      error: error.message,
      samsung: null, samsungChg: null,
      hynix: null, hynixChg: null,
      nvda: null, nvdaChg: null,
      nasdaq: null, nasdaqChg: null,
      sp500: null, sp500Chg: null,
      sox: null, soxChg: null,
      vix: null, vixChg: null,
      nasdaqFut: null, nasdaqFutChg: null,
      kospiFut: null, kospiFutChg: null,
      wti: null, wtiChg: null,
      usdkrw: null, usdkrwChg: null,
      updatedAt: new Date().toISOString(),
    });
  }
}
