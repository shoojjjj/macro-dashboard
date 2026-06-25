const KST_DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function todayKstDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export function addDaysKst(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

export function unixToKst(unixSec) {
  if (unixSec == null || !Number.isFinite(unixSec)) return { date: null, timeKst: null };
  const d = new Date(unixSec * 1000);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
  const timeKst = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { date, timeKst };
}

export function formatKstEventDateShort(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const dow = KST_DOW[d.getUTCDay()];
  return `${dd}(${dow})`;
}

export function formatKstEventDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const dow = KST_DOW[d.getUTCDay()];
  return `${mm}/${dd} (${dow})`;
}

export function formatKstTime(timeKst) {
  if (!timeKst) return '—';
  return `${timeKst} KST`;
}

export function importanceStars(level) {
  if (level >= 3) return '🔥🔥🔥';
  if (level >= 2) return '🔥🔥';
  return '🔥';
}

export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return (a.timeKst || '99:99').localeCompare(b.timeKst || '99:99');
  });
}

const MACRO_MATCHERS = [
  { key: 'cpi', patterns: ['cpi', 'consumer price', '소비자물가'] },
  { key: 'nfp', patterns: ['nfp', 'nonfarm', 'non-farm', '비농업 고용'] },
  { key: 'gdp', patterns: ['gdp', 'gross domestic product'] },
  { key: 'pce', patterns: ['pce', 'personal consumption', '개인소비'] },
  { key: 'fomc', patterns: ['fomc', 'federal open market', '연방공개시장', '금리 결정'] },
  { key: 'ppi', patterns: ['ppi', 'producer price', '생산자물가'] },
  { key: 'retail', patterns: ['retail sales', '소매판매'] },
  { key: 'jobless', patterns: ['jobless', 'unemployment claims', '실업수당', 'initial claims'] },
  { key: 'ism', patterns: ['ism manufacturing', 'ism services'] },
  { key: 'fed', patterns: ['fed chair', 'fed interest', 'powell'] },
];

function normalizeTitle(title) {
  return String(title || '')
    .replace(/^미\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function eventDedupeKey(event) {
  const title = normalizeTitle(event.title);
  for (const { key, patterns } of MACRO_MATCHERS) {
    if (patterns.some((p) => title.includes(p))) {
      return `${event.date}|${event.timeKst || ''}|${key}`;
    }
  }
  if (event.category === '기업실적') {
    const base = title.replace(/\s*실적\s*$/, '').replace(/\s*잠정실적\s*$/, '');
    return `${event.date}|${event.timeKst || ''}|earn|${base}`;
  }
  if (event.category === '국내이슈') {
    const base = title.replace(/\s*(adr\/dr|ir)\s*$/i, '');
    return `${event.date}|${event.timeKst || ''}|kr|${base}`;
  }
  return `${event.date}|${event.timeKst || ''}|${title}|${event.category || ''}`;
}

function eventQualityScore(event) {
  let score = (event.importance || 1) * 10;
  if (event.source === 'fred') score += 8;
  if (event.source === 'fed') score += 8;
  if (event.source === 'ff') score += 5;
  if (event.source === 'naver') score += 4;
  if (event.note && /예상|이전|forecast|previous/i.test(event.note)) score += 4;
  score += Math.min((event.note || '').length, 40) / 10;
  return score;
}

export function dedupeEvents(events) {
  const best = new Map();
  for (const event of events) {
    const key = eventDedupeKey(event);
    const prev = best.get(key);
    if (!prev || eventQualityScore(event) > eventQualityScore(prev)) {
      best.set(key, event);
    }
  }
  return [...best.values()];
}

export function groupEventsByDate(events, startDate, dayCount) {
  const grouped = new Map();
  for (const ev of events) {
    if (!grouped.has(ev.date)) grouped.set(ev.date, []);
    grouped.get(ev.date).push(ev);
  }
  const days = [];
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDaysKst(startDate, i);
    const list = grouped.get(date) || [];
    days.push({
      date,
      label: formatKstEventDate(date),
      isToday: date === todayKstDateStr(),
      events: sortEvents(list),
    });
  }
  return days;
}

export function filterEventsInRange(events, startDate, endDateExclusive) {
  return events.filter((e) => e.date >= startDate && e.date < endDateExclusive);
}
