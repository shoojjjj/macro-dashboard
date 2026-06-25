// pages/api/liquidity.js
// FRED API로 Fed 총자산 / TGA / RRP / MMF 조회
// Net Liquidity = Fed Assets - TGA - RRP

const SERIES = {
  fed: 'WALCL',
  tga: 'WTREGEN',
  rrp: 'RRPONTSYD',
  mmf: 'WRMFSL',
};

const PERIOD_CONFIG = {
  day: { limit: 30, slice: 10, label: '최근 10주 (일간 스냅샷)' },
  week: { limit: 52, slice: 12, label: '최근 12주' },
  month: { limit: 156, slice: 12, label: '최근 12개월' },
};

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

async function fetchSeries(seriesId, limit, apiKey) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${seriesId} error: ${r.status}`);
  const d = await r.json();
  return d.observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

function toTrillions(value, unit) {
  if (unit === 'millions') return +(value / 1_000_000).toFixed(3);
  return +(value / 1_000).toFixed(3);
}

function alignWeeklySeries(fedData, tgaData, rrpData, slice) {
  const rrpByDate = new Map(rrpData.map((d) => [d.date, d.value]));
  const points = fedData.map((f, i) => {
    const tga = tgaData[i]?.value ?? tgaData.at(-1)?.value ?? 0;
    const rrpEntry = rrpData.find((r) => r.date <= f.date) ?? rrpData.at(-1);
    const rrp = rrpEntry?.value ?? 0;
    const fedT = toTrillions(f.value, 'millions');
    const tgaT = toTrillions(tga, 'millions');
    const rrpT = toTrillions(rrp, 'billions');
    return {
      x: f.date,
      fed: fedT,
      tga: tgaT,
      rrp: rrpT,
      net: +(fedT - tgaT - rrpT).toFixed(3),
    };
  });
  return points.slice(-slice);
}

function aggregateMonthly(points) {
  const buckets = new Map();
  for (const p of points) {
    const key = p.x.slice(0, 7);
    buckets.set(key, p);
  }
  return [...buckets.values()];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  const FRED_KEY = process.env.FRED_API_KEY;
  if (!FRED_KEY) {
    return res.status(500).json({ error: 'FRED_API_KEY not set' });
  }

  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'week';
  const cfg = PERIOD_CONFIG[period];

  try {
    const [fedData, tgaData, rrpData, mmfData] = await Promise.all([
      fetchSeries(SERIES.fed, cfg.limit, FRED_KEY),
      fetchSeries(SERIES.tga, cfg.limit, FRED_KEY),
      fetchSeries(SERIES.rrp, cfg.limit, FRED_KEY),
      fetchSeries(SERIES.mmf, cfg.limit, FRED_KEY),
    ]);

    let aligned = alignWeeklySeries(fedData, tgaData, rrpData, period === 'month' ? 52 : cfg.slice);
    if (period === 'month') aligned = aggregateMonthly(aligned).slice(-12);

    const latestFed = fedData.at(-1)?.value / 1_000_000 ?? null;
    const latestTga = tgaData.at(-1)?.value / 1_000_000 ?? null;
    const latestRrp = rrpData.at(-1)?.value / 1_000 ?? null;
    const latestMmf = mmfData.at(-1)?.value / 1_000 ?? null;
    const netLiquidity = (latestFed != null && latestTga != null && latestRrp != null)
      ? latestFed - latestTga - latestRrp
      : null;

    res.status(200).json({
      period,
      periodLabel: cfg.label,
      current: {
        fed: latestFed != null ? +latestFed.toFixed(3) : null,
        tga: latestTga != null ? +latestTga.toFixed(3) : null,
        rrp: latestRrp != null ? +latestRrp.toFixed(3) : null,
        mmf: latestMmf != null ? +latestMmf.toFixed(3) : null,
        netLiquidity: netLiquidity != null ? +netLiquidity.toFixed(3) : null,
      },
      series: {
        net: aligned.map((p) => ({ x: p.x, y: p.net })),
        fed: aligned.map((p) => ({ x: p.x, y: p.fed })),
        tga: aligned.map((p) => ({ x: p.x, y: p.tga })),
        rrp: aligned.map((p) => ({ x: p.x, y: p.rrp })),
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Liquidity API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
