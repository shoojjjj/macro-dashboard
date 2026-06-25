import { getMergedWatchlistKR, getMergedWatchlistUS } from './watchlist';

/** 검색·자동완성용 확장 종목 (관심종목 외) */
const SEARCH_KR = [
  { code: '011070', label: 'LG이노텍', aliases: ['lg이노텍', '이노텍'] },
  { code: '066570', label: 'LG전자', aliases: ['lg전자'] },
  { code: '003550', label: 'LG', aliases: [] },
  { code: '051910', label: 'LG화학', aliases: ['lg화학'] },
  { code: '034220', label: 'LG디스플레이', aliases: ['lg디스플레이'] },
  { code: '009150', label: '삼성전기', aliases: ['삼성전기'] },
  { code: '005930', label: '삼성전자', aliases: ['삼성전자'] },
  { code: '006400', label: '삼성SDI', aliases: ['삼성sdi'] },
  { code: '207940', label: '삼성바이오로직스', aliases: ['삼바', '삼성바이오'] },
  { code: '028260', label: '삼성물산', aliases: [] },
  { code: '018260', label: '삼성에스디에스', aliases: ['삼성sds'] },
  { code: '032830', label: '삼성생명', aliases: [] },
  { code: '010140', label: '삼성중공업', aliases: [] },
  { code: '005380', label: '현대차', aliases: ['현대자동차'] },
  { code: '000270', label: '기아', aliases: [] },
  { code: '035420', label: '네이버', aliases: [] },
  { code: '035720', label: '카카오', aliases: [] },
  { code: '373220', label: 'LG에너지솔루션', aliases: ['lges'] },
  { code: '105560', label: 'KB금융', aliases: [] },
  { code: '055550', label: '신한지주', aliases: [] },
];

/** 미국 티커 검색용 (관심종목·히트맵 외) */
const SEARCH_US = [
  { sym: 'NVDA', label: '엔VIDIA', aliases: ['nvidia'] },
  { sym: 'AAPL', label: '애플', aliases: ['apple'] },
  { sym: 'MSFT', label: '마이크로소프트', aliases: ['microsoft'] },
  { sym: 'GOOGL', label: '구글', aliases: ['google', 'alphabet'] },
  { sym: 'META', label: '메타', aliases: ['facebook'] },
  { sym: 'AMZN', label: '아마존', aliases: ['amazon'] },
  { sym: 'TSLA', label: '테슬라', aliases: ['tesla'] },
  { sym: 'AMD', label: 'AMD', aliases: [] },
  { sym: 'AVGO', label: '브로드컴', aliases: ['broadcom'] },
  { sym: 'INTC', label: '인텔', aliases: ['intel'] },
  { sym: 'SNDK', label: '샌드스크', aliases: ['sandisk', 'sdsk', 'sndk'] },
  { sym: 'MU', label: '마이크론', aliases: ['micron'] },
  { sym: 'MRVL', label: '마벨', aliases: ['marvell'] },
  { sym: 'LITE', label: '루멘텀', aliases: ['lumentum'] },
  { sym: 'IONQ', label: '아이온큐', aliases: [] },
  { sym: 'CRDO', label: '크리도', aliases: [] },
  { sym: 'IREN', label: '아이렌', aliases: [] },
  { sym: 'QCOM', label: '퀄컴', aliases: ['qualcomm'] },
  { sym: 'ASML', label: 'ASML', aliases: ['asml'] },
  { sym: 'ASAN', label: 'Asana', aliases: ['asana'] },
  { sym: 'ASTS', label: 'AST SpaceMobile', aliases: [] },
  { sym: 'ASX', label: 'ASE Technology', aliases: [] },
  { sym: 'PLTR', label: '팔란티어', aliases: ['palantir'] },
  { sym: 'SMCI', label: '슈퍼마이크로', aliases: ['supermicro'] },
  { sym: 'ARM', label: 'ARM', aliases: [] },
  { sym: 'TSM', label: 'TSMC', aliases: ['tsmc'] },
  { sym: 'COIN', label: '코인베이스', aliases: ['coinbase'] },
  { sym: 'NFLX', label: '넷플릭스', aliases: ['netflix'] },
  { sym: 'CRM', label: '세일즈포스', aliases: ['salesforce'] },
  { sym: 'ORCL', label: '오라클', aliases: ['oracle'] },
  { sym: 'JPM', label: 'JP모건', aliases: [] },
  { sym: 'BAC', label: '뱅크오브아메리카', aliases: [] },
  { sym: 'SPY', label: 'S&P500 ETF', aliases: [] },
  { sym: 'QQQ', label: '나스닥100 ETF', aliases: [] },
];

/** 티커 접두 검색용 (AS → ASML 등) */
const US_PREFIX_TICKERS = [
  ...SEARCH_US.map((x) => x.sym),
  'ASML', 'ASAN', 'ASTS', 'ASX', 'AS', 'ABNB', 'ABT', 'ACN', 'ADBE', 'ADI', 'ADSK', 'AEM',
  'AMAT', 'ANET', 'APH', 'APP', 'BA', 'BABA', 'BKNG', 'BLK', 'C', 'CAT', 'CEG', 'COST',
  'CRWD', 'CSCO', 'CVX', 'DELL', 'DIS', 'EA', 'ETN', 'F', 'GE', 'GILD', 'GM', 'GS',
  'HD', 'HON', 'IBM', 'ISRG', 'JNJ', 'KO', 'LLY', 'LOW', 'LRCX', 'MA', 'MCD', 'MDLZ',
  'MRK', 'MS', 'NKE', 'NOW', 'PANW', 'PEP', 'PFE', 'PG', 'PYPL', 'SBUX', 'SCHW', 'SHOP',
  'SNOW', 'SOFI', 'SQ', 'TMUS', 'UBER', 'UNH', 'UPS', 'V', 'VRT', 'VZ', 'WFC', 'WMT', 'XOM',
];

const US_TICKER_ALIASES = {
  SDSK: 'SNDK',
};

function norm(s) {
  return String(s).replace(/\s/g, '').toLowerCase();
}

function isTickerLikeQuery(q) {
  return /^[a-z0-9.^=-]{1,12}$/i.test(q) && !/[가-힣]/.test(q);
}

function catalogItemToResolved(item) {
  if (item.market === 'kr') {
    return {
      market: 'kr',
      code: item.code,
      label: item.label,
      yahooCandidates: [`${item.code}.KS`, `${item.code}.KQ`],
      dropdown: `kr:${item.code}`,
    };
  }
  return {
    market: 'us',
    sym: item.sym,
    label: item.label,
    yahooCandidates: [item.sym],
    dropdown: `us:${item.sym}`,
  };
}

export function watchlistToCatalog(kr = [], us = []) {
  const items = [];
  (kr || []).forEach((x) => {
    if (x?.code) items.push({ market: 'kr', code: x.code, label: x.label || x.code, aliases: [] });
  });
  (us || []).forEach((x) => {
    if (x?.sym) items.push({ market: 'us', sym: x.sym, label: x.label || x.sym, aliases: [] });
  });
  return items;
}

function mergeCatalog(base, extraItems = []) {
  const seen = new Set(base.map((i) => (i.market === 'kr' ? `kr:${i.code}` : `us:${i.sym}`)));
  const out = [...base];
  extraItems.forEach((item) => {
    const key = item.market === 'kr' ? `kr:${item.code}` : `us:${item.sym}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

export function buildSymbolCatalog() {
  const items = [];
  getMergedWatchlistKR().forEach((x) => {
    items.push({ market: 'kr', code: x.code, label: x.label, aliases: [] });
  });
  SEARCH_KR.forEach((x) => {
    if (!items.some((i) => i.market === 'kr' && i.code === x.code)) {
      items.push({ market: 'kr', code: x.code, label: x.label, aliases: x.aliases || [] });
    }
  });
  getMergedWatchlistUS().forEach((x) => {
    items.push({ market: 'us', sym: x.sym, label: x.label, aliases: [] });
  });
  SEARCH_US.forEach((x) => {
    if (!items.some((i) => i.market === 'us' && i.sym === x.sym)) {
      items.push({ market: 'us', sym: x.sym, label: x.label, aliases: x.aliases || [] });
    }
  });
  return items;
}

function scoreKrMatch(nq, item) {
  const nl = norm(item.label);
  const aliases = (item.aliases || []).map(norm);
  if (nl === nq) return 100;
  if (item.code === nq) return 95;
  if (nl.startsWith(nq)) return 85 + Math.min(14, Math.floor((nq.length / nl.length) * 14));
  if (aliases.some((a) => a === nq || a.startsWith(nq) || nq.startsWith(a))) return 80;
  if (nl.includes(nq)) return 70;
  if (aliases.some((a) => a.includes(nq) || nq.includes(a))) return 65;
  return 0;
}

function scoreUsMatch(nq, item) {
  const ns = norm(item.sym);
  const nl = norm(item.label);
  const aliases = (item.aliases || []).map(norm);
  if (ns === nq) return 100;
  if (aliases.some((a) => a === nq)) return 98;
  if (ns.startsWith(nq)) return 92 + Math.min(7, Math.floor((nq.length / ns.length) * 7));
  if (aliases.some((a) => a.startsWith(nq) || nq.startsWith(a))) return 88;
  if (nl.includes(nq)) return 75;
  if (ns.includes(nq)) return 72;
  return 0;
}

function scoreMatch(nq, item) {
  if (item.market === 'us') return scoreUsMatch(nq, item);
  return scoreKrMatch(nq, item);
}

function suggestionFromItem(item) {
  return {
    market: item.market,
    code: item.code,
    sym: item.sym,
    label: item.label,
    display: item.market === 'kr'
      ? `${item.label} (${item.code})`
      : `${item.label} (${item.sym})`,
    dropdown: item.market === 'kr' ? `kr:${item.code}` : `us:${item.sym}`,
  };
}

function resolvedFromSuggestion(s) {
  if (s.market === 'kr') {
    return { market: 'kr', code: s.code, label: s.label, yahooCandidates: [`${s.code}.KS`, `${s.code}.KQ`] };
  }
  return { market: 'us', sym: s.sym, label: s.label, yahooCandidates: [s.sym] };
}

function normalizeQuery(rawQuery) {
  let q = String(rawQuery || '').trim();
  const paren = q.match(/^(.+?)\s*\((\d{6}|[A-Z0-9.^=-]{1,12})\)\s*$/i);
  if (paren) q = paren[1].trim();
  return q;
}

function balanceSuggestions(scored, limit, tickerLike) {
  if (!scored.length) return [];
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, 'ko'));

  // 짧은 티커 검색(LR 등)은 점수순 그대로 — 시장 quota로 정확 매치가 밀리지 않게
  if (tickerLike && sorted[0]?.score >= 90) {
    return sorted.slice(0, limit);
  }

  const kr = sorted.filter((x) => x.item.market === 'kr');
  const us = sorted.filter((x) => x.item.market === 'us');
  const out = [];
  const seen = new Set();
  const push = (entry) => {
    const key = entry.item.market === 'kr' ? `kr:${entry.item.code}` : `us:${entry.item.sym}`;
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(entry);
  };

  if (tickerLike) {
    us.slice(0, Math.ceil(limit * 0.6)).forEach(push);
    kr.slice(0, Math.ceil(limit * 0.4)).forEach(push);
    scored.forEach(push);
  } else {
    kr.slice(0, Math.ceil(limit * 0.55)).forEach(push);
    us.slice(0, Math.ceil(limit * 0.45)).forEach(push);
    scored.forEach(push);
  }
  return out.slice(0, limit);
}

export function getDefaultSymbolSuggestions(limit = 40, extraItems = []) {
  const catalog = mergeCatalog(buildSymbolCatalog(), extraItems);
  const kr = catalog.filter((x) => x.market === 'kr');
  const us = catalog.filter((x) => x.market === 'us');
  const half = Math.ceil(limit / 2);
  const picked = [...kr.slice(0, half), ...us.slice(0, half)];
  const seen = new Set();
  const out = [];
  picked.forEach((item) => {
    const key = item.market === 'kr' ? `kr:${item.code}` : `us:${item.sym}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...suggestionFromItem(item), score: 50 });
  });
  catalog.forEach((item) => {
    if (out.length >= limit) return;
    const key = item.market === 'kr' ? `kr:${item.code}` : `us:${item.sym}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...suggestionFromItem(item), score: 40 });
  });
  return out.slice(0, limit);
}

export function searchSymbolSuggestions(rawQuery, limit = 15, extraItems = []) {
  const q = normalizeQuery(rawQuery);
  if (!q || q.length < 1) return getDefaultSymbolSuggestions(limit, extraItems);

  if (/^\d{6}$/.test(q)) {
    const catalog = mergeCatalog(buildSymbolCatalog(), extraItems);
    const hit = catalog.find((x) => x.market === 'kr' && x.code === q);
    return [{
      ...suggestionFromItem(hit || { market: 'kr', code: q, label: q }),
      score: 100,
    }];
  }

  const nq = norm(q);
  const tickerLike = isTickerLikeQuery(q);
  const effectiveLimit = nq.length <= 2 ? Math.max(limit, 24) : limit;
  const catalog = mergeCatalog(buildSymbolCatalog(), extraItems);

  let scored = catalog
    .map((item) => ({ item, score: scoreMatch(nq, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, 'ko'));

  if (tickerLike && nq.length >= 2) {
    scored = scored.filter(({ item, score }) => {
      if (item.market === 'us') {
        const ns = norm(item.sym);
        return ns === nq || ns.startsWith(nq) || score >= 88;
      }
      const nl = norm(item.label);
      return nl.includes(nq) || String(item.code).includes(nq) || score >= 80;
    });
  }

  if (tickerLike) {
    const upper = q.toUpperCase();
    const mapped = US_TICKER_ALIASES[upper];
    const sym = mapped || upper;
    const hit = catalog.find((x) => x.market === 'us' && x.sym === sym);
    const synthetic = {
      item: hit || { market: 'us', sym, label: hit?.label || sym, aliases: [] },
      score: hit ? 101 : 96,
    };
    if (!scored.some((x) => x.item.market === 'us' && x.item.sym === sym)) {
      scored = [synthetic, ...scored];
    }

    if (nq.length >= 2) {
      const prefixHits = US_PREFIX_TICKERS
        .filter((t) => t.startsWith(upper) && t !== upper)
        .slice(0, 10);
      prefixHits.forEach((ticker) => {
        if (scored.some((x) => x.item.market === 'us' && x.item.sym === ticker)) return;
        const catHit = catalog.find((x) => x.market === 'us' && x.sym === ticker);
        scored.push({
          item: catHit || { market: 'us', sym: ticker, label: catHit?.label || ticker, aliases: [] },
          score: 93 + Math.min(6, nq.length),
        });
      });
    }
  }

  return balanceSuggestions(scored, effectiveLimit, tickerLike).map(({ item, score }) => ({
    ...suggestionFromItem(item),
    score,
  }));
}

export function resolveStockQuery(rawQuery, dropdownValue) {
  if (dropdownValue) {
    const [market, id] = dropdownValue.split(':');
    if (market === 'kr') {
      const item = buildSymbolCatalog().find((x) => x.market === 'kr' && x.code === id);
      if (item) return catalogItemToResolved(item);
      return { market: 'kr', code: id, label: id, yahooCandidates: [`${id}.KS`, `${id}.KQ`] };
    }
    if (market === 'us') {
      const item = buildSymbolCatalog().find((x) => x.market === 'us' && x.sym === id);
      if (item) return catalogItemToResolved(item);
      return { market: 'us', sym: id, label: id, yahooCandidates: [id] };
    }
  }

  const q = normalizeQuery(rawQuery);
  if (!q) return null;

  if (/^\d{6}$/.test(q)) {
    const catalog = buildSymbolCatalog();
    const hit = catalog.find((x) => x.market === 'kr' && x.code === q);
    if (hit) return catalogItemToResolved(hit);
    return { market: 'kr', code: q, label: q, yahooCandidates: [`${q}.KS`, `${q}.KQ`] };
  }

  const upper = q.toUpperCase();
  if (isTickerLikeQuery(q)) {
    const mapped = US_TICKER_ALIASES[upper] || upper;
    const catalog = buildSymbolCatalog();
    const hit = catalog.find((x) => x.market === 'us' && (x.sym === mapped || norm(x.label) === norm(q)));
    if (hit) return catalogItemToResolved(hit);
    return { market: 'us', sym: mapped, label: hit?.label || mapped, yahooCandidates: [mapped] };
  }

  const suggestions = searchSymbolSuggestions(q, 10);
  if (!suggestions.length) return null;

  const exactLabel = suggestions.find((s) => norm(s.label) === norm(q));
  if (exactLabel) return resolvedFromSuggestion(exactLabel);

  const exactSym = suggestions.find((s) => s.market === 'us' && norm(s.sym) === norm(q));
  if (exactSym) return resolvedFromSuggestion(exactSym);

  if (suggestions.length === 1) return resolvedFromSuggestion(suggestions[0]);

  const top = suggestions[0];
  const second = suggestions[1];
  if (top.score >= 100 || (top.score >= 90 && top.score - (second?.score || 0) >= 10)) {
    return resolvedFromSuggestion(top);
  }

  return null;
}

export function getDropdownOptions() {
  return {
    kr: getMergedWatchlistKR(),
    us: getMergedWatchlistUS(),
  };
}
