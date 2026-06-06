// pages/api/liquidity.js
// FRED API로 Fed 총자산 / TGA / RRP / MMF 실시간 조회
// Net Liquidity = Fed Assets - TGA - RRP

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  const FRED_KEY = process.env.FRED_API_KEY;
  if (!FRED_KEY) {
    return res.status(500).json({ error: 'FRED_API_KEY not set' });
  }

  // FRED 시리즈 ID
  const SERIES = {
    fed:  'WALCL',    // Fed 총자산 (Millions USD, 주간)
    tga:  'WTREGEN',  // TGA 재무부 일반계정 (Millions USD, 주간)
    rrp:  'RRPONTSYD',// RRP 역레포 잔고 (Billions USD, 일간)
    mmf:  'WRMFSL',   // MMF 잔고 (Billions USD, 주간)
  };

  const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

  // 최근 30개 데이터 포인트 가져오기
  async function fetchSeries(seriesId, limit = 30) {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FRED ${seriesId} error: ${r.status}`);
    const d = await r.json();
    // 오래된 순으로 정렬, 숫자로 변환
    return d.observations
      .filter(o => o.value !== '.')
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse();
  }

  try {
    const [fedData, tgaData, rrpData, mmfData] = await Promise.all([
      fetchSeries(SERIES.fed, 30),
      fetchSeries(SERIES.tga, 30),
      fetchSeries(SERIES.rrp, 30),
      fetchSeries(SERIES.mmf, 30),
    ]);

    // 최신값 (Millions → Trillions 변환)
    const latestFed = fedData.at(-1)?.value / 1_000_000 ?? null;  // Millions → Trillions
    const latestTga = tgaData.at(-1)?.value / 1_000_000 ?? null;
    const latestRrp = rrpData.at(-1)?.value / 1_000 ?? null;       // Billions → Trillions
    const latestMmf = mmfData.at(-1)?.value / 1_000 ?? null;

    // Net Liquidity = Fed - TGA - RRP
    const netLiquidity = (latestFed !== null && latestTga !== null && latestRrp !== null)
      ? latestFed - latestTga - latestRrp
      : null;

    // 차트용 시계열 (주간 기준, 최근 12주)
    const weeklyFed = fedData.slice(-12).map(d => ({ x: d.date, y: +(d.value / 1_000_000).toFixed(3) }));
    const weeklyTga = tgaData.slice(-12).map(d => ({ x: d.date, y: +(d.value / 1_000_000).toFixed(3) }));
    const weeklyRrp = rrpData.slice(-12).map(d => ({ x: d.date, y: +(d.value / 1_000).toFixed(3) }));

    // Net Liquidity 시계열 (Fed/TGA 날짜 기준 교차 계산)
    const netSeries = weeklyFed.map((f, i) => {
      const t = weeklyTga[i]?.y ?? 0;
      const r = weeklyRrp[i]?.y ?? 0;
      return { x: f.x, y: +(f.y - t - r).toFixed(3) };
    });

    res.status(200).json({
      current: {
        fed:          latestFed ? +latestFed.toFixed(3) : null,
        tga:          latestTga ? +latestTga.toFixed(3) : null,
        rrp:          latestRrp ? +latestRrp.toFixed(3) : null,
        mmf:          latestMmf ? +latestMmf.toFixed(3) : null,
        netLiquidity: netLiquidity ? +netLiquidity.toFixed(3) : null,
      },
      series: {
        fed:  weeklyFed,
        tga:  weeklyTga,
        rrp:  weeklyRrp,
        net:  netSeries,
      },
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Liquidity API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
