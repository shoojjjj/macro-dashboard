const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'text/html,application/xhtml+xml',
  Referer: 'https://news.naver.com/',
};

const POPULAR_DAY_URL = 'https://news.naver.com/main/ranking/popularDay.naver';

const CATEGORIES = [
  {
    id: 'us',
    label: '미장',
    keywords: [/미국|나스닥|NASDAQ|S&P|NYSE|미장|ADR|워시|트럼프|엔비디아|NVDA|빅테크|월가|fed\b|연준/i],
    fallbackQuery: '나스닥',
  },
  {
    id: 'kr',
    label: '국장',
    keywords: [/코스피|코스닥|KOSPI|KOSDAQ|국내.?증시|국장|삼성|하이닉스|SK하이닉스|증시|주식시장|공시|코스피200|코스닥150/i],
    fallbackQuery: '코스피',
  },
  {
    id: 'macro',
    label: '거시환경',
    keywords: [/연준|FOMC|금리|CPI|GDP|인플레|VIX|유가|WTI|금값|금\s*시세|거시|경기침체|양적/i],
    fallbackQuery: '연준',
  },
  {
    id: 'economy',
    label: '경제',
    keywords: [/경제|금융|대출|가계|물가|고용|부동산|세금|은행|채권|실업|소비/i],
    fallbackQuery: '경제',
  },
  {
    id: 'fx',
    label: '환율',
    keywords: [/환율|원\/달러|원달러|달러|엔화|외환|달러인덱스|환전/i],
    fallbackQuery: '환율',
  },
];

const HEADLINE_ORDER = CATEGORIES.map((c) => c.id);

function decodeHtml(str) {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchNaverHtml(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const buf = await r.arrayBuffer();
  return new TextDecoder('euc-kr').decode(buf);
}

function parseHoursAgo(timeText) {
  const t = String(timeText || '').trim();
  if (/방금|분전/.test(t)) return 0;
  const h = t.match(/(\d+)\s*시간전/);
  if (h) return parseInt(h[1], 10);
  const d = t.match(/(\d+)\s*일전/);
  if (d) return parseInt(d[1], 10) * 24;
  if (/어제|전일/.test(t)) return 48;
  return 999;
}

function isFreshNews(timeText) {
  const hours = parseHoursAgo(timeText);
  return hours < 24;
}

/** 네이버 언론사별 '많이 본 뉴스' (조회수 랭킹) */
function parsePopularRanking(html, limit = 500) {
  const items = [];
  const regex = /<li>\s*<em class="list_ranking_num">(\d+)[\s\S]*?<a href="(https:\/\/n\.news\.naver\.com\/article\/[^"]+)" class="list_title[^"]*">([^<]+)<\/a>\s*<span class="list_time[^"]*">([^<]+)<\/span>/g;
  let m;
  while ((m = regex.exec(html)) !== null && items.length < limit) {
    items.push({
      rank: parseInt(m[1], 10),
      url: m[2],
      title: decodeHtml(m[3].trim()),
      time: decodeHtml(m[4].trim()),
      source: '네이버 많이 본 뉴스',
    });
  }
  return items;
}

function scoreTitle(title, keywords) {
  return keywords.reduce((s, re) => (re.test(title) ? s + 1 : s), 0);
}

function pickCategoryArticles(allItems, configs) {
  const fresh = allItems.filter((item) => isFreshNews(item.time));
  const pool = fresh.length ? fresh : allItems;
  const sorted = [...pool].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return parseHoursAgo(a.time) - parseHoursAgo(b.time);
  });

  const used = new Set();
  const categories = {};

  configs.forEach((cfg) => {
    const matched = [];
    for (const item of sorted) {
      if (used.has(item.url)) continue;
      const score = scoreTitle(item.title, cfg.keywords);
      if (score > 0) matched.push({ item, score });
    }
    matched.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.rank !== b.item.rank) return a.item.rank - b.item.rank;
      return parseHoursAgo(a.item.time) - parseHoursAgo(b.item.time);
    });

    const picked = [];
    matched.forEach(({ item }) => {
      if (picked.length >= 4 || used.has(item.url)) return;
      picked.push(item);
      used.add(item.url);
    });

    if (picked.length < 4) {
      for (const item of sorted) {
        if (picked.length >= 4) break;
        if (used.has(item.url)) continue;
        picked.push(item);
        used.add(item.url);
      }
    }

    categories[cfg.id] = {
      label: cfg.label,
      items: picked.map((item) => ({
        ...item,
        category: cfg.id,
        categoryLabel: cfg.label,
      })),
    };
  });

  return categories;
}

function naverNewsSearchUrl(query) {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

function getMoverForCategory(cat, market = {}) {
  const maps = {
    us: [
      { label: '나스닥100', chg: market.nasdaqChg, min: 0.8 },
      { label: 'S&P500', chg: market.sp500Chg, min: 0.8 },
      { label: '필라델피아 반도체', chg: market.soxChg, min: 1 },
      { label: '엔비디아', chg: market.nvdaChg, min: 1 },
    ],
    kr: [
      { label: '코스피', chg: market.kospiChg, min: 0.8 },
      { label: '코스닥', chg: market.kosdaqChg, min: 0.8 },
      { label: 'KOSPI200', chg: market.kospi200Chg, min: 0.8 },
      { label: '코스닥150', chg: market.kosdaq150Chg, min: 0.8 },
      { label: '삼성전자', chg: market.samsungChg, min: 1 },
      { label: 'SK하이닉스', chg: market.hynixChg, min: 1 },
    ],
    macro: [
      { label: 'VIX', chg: market.vixChg, min: 3 },
      { label: 'WTI 유가', chg: market.wtiChg, min: 1.5 },
      { label: '원/달러', chg: market.usdkrwChg, min: 0.3 },
    ],
    fx: [{ label: '원/달러', chg: market.usdkrwChg, min: 0.3 }],
    economy: [
      { label: 'WTI 유가', chg: market.wtiChg, min: 1.5 },
      { label: 'VIX', chg: market.vixChg, min: 3 },
    ],
  };
  const candidates = (maps[cat] ?? []).filter((c) => c.chg != null && Math.abs(c.chg) >= c.min);
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg));
  return candidates[0];
}

function buildCategoryHeadline(cat, article, market, fallbackQuery) {
  const mover = getMoverForCategory(cat, market);
  const title = article?.title ?? '주요 뉴스';
  const url = article?.url ?? naverNewsSearchUrl(fallbackQuery ?? title);
  if (!mover) {
    return { headline: title, url, mover: null };
  }
  const dir = mover.chg > 0 ? '급등' : '급락';
  const pct = `${mover.chg >= 0 ? '+' : ''}${mover.chg.toFixed(2)}%`;
  return {
    headline: `[${mover.label} ${dir} ${pct}] ${title}`,
    url,
    mover: { label: mover.label, chg: mover.chg },
  };
}

function buildHeadlines(categories, market, configs) {
  const headlines = {};
  HEADLINE_ORDER.forEach((id) => {
    const block = categories[id];
    const cfg = configs.find((c) => c.id === id);
    const top = block?.items?.[0] ?? null;
    const built = buildCategoryHeadline(id, top, market, cfg?.fallbackQuery ?? block?.label);
    headlines[id] = {
      label: block?.label ?? id,
      ...built,
      publishedAgo: top?.time ?? null,
      rank: top?.rank ?? null,
    };
  });
  return headlines;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  const market = req.method === 'POST' ? (req.body?.market ?? {}) : {};

  try {
    const html = await fetchNaverHtml(POPULAR_DAY_URL);
    const ranked = parsePopularRanking(html);
    const categories = pickCategoryArticles(ranked, CATEGORIES);
    const headlines = buildHeadlines(categories, market, CATEGORIES);

    res.status(200).json({
      headlines,
      categories,
      source: 'naver-popularDay',
      rankedCount: ranked.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News API Error:', error);
    res.status(200).json({ headlines: {}, categories: {}, error: error.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };
