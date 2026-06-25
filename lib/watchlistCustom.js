import fs from 'fs';
import path from 'path';

const CUSTOM_PATH = path.join(process.cwd(), 'data/custom-watchlist.json');

function emptyCustom() {
  return { kr: [], us: [], hiddenKr: [], hiddenUs: [] };
}

export function readCustomWatchlist() {
  try {
    const raw = fs.readFileSync(CUSTOM_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      kr: Array.isArray(parsed.kr) ? parsed.kr : [],
      us: Array.isArray(parsed.us) ? parsed.us : [],
      hiddenKr: Array.isArray(parsed.hiddenKr) ? parsed.hiddenKr : [],
      hiddenUs: Array.isArray(parsed.hiddenUs) ? parsed.hiddenUs : [],
    };
  } catch {
    return emptyCustom();
  }
}

export function writeCustomWatchlist(data) {
  fs.mkdirSync(path.dirname(CUSTOM_PATH), { recursive: true });
  fs.writeFileSync(CUSTOM_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function addToCustomWatchlist(entry) {
  const data = readCustomWatchlist();
  const list = entry.market === 'kr' ? data.kr : data.us;
  const exists = list.some((x) =>
    entry.market === 'kr' ? x.code === entry.code : x.sym === entry.sym);
  if (exists) return { added: false, reason: 'already_exists', data };

  if (entry.market === 'kr') {
    data.hiddenKr = (data.hiddenKr || []).filter((c) => c !== entry.code);
  } else {
    data.hiddenUs = (data.hiddenUs || []).filter((s) => s !== entry.sym);
  }

  const item = entry.market === 'kr'
    ? { code: entry.code, label: entry.label }
    : { sym: entry.sym, label: entry.label };
  list.push(item);
  try {
    writeCustomWatchlist(data);
  } catch {
    return { added: true, persisted: false, data };
  }
  return { added: true, persisted: true, data };
}

export function removeFromWatchlist(entry) {
  const data = readCustomWatchlist();
  data.hiddenKr = data.hiddenKr || [];
  data.hiddenUs = data.hiddenUs || [];

  if (entry.market === 'kr') {
    const code = String(entry.code);
    data.kr = data.kr.filter((x) => x.code !== code);
    if (!data.hiddenKr.includes(code)) data.hiddenKr.push(code);
  } else if (entry.market === 'us') {
    const sym = String(entry.sym).toUpperCase();
    data.us = data.us.filter((x) => x.sym !== sym);
    if (!data.hiddenUs.includes(sym)) data.hiddenUs.push(sym);
  } else {
    return { removed: false, reason: 'invalid_market', data };
  }

  try {
    writeCustomWatchlist(data);
    return { removed: true, persisted: true, data };
  } catch {
    return { removed: true, persisted: false, data };
  }
}
