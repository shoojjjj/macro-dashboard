import { addToCustomWatchlist, readCustomWatchlist, removeFromWatchlist } from '../../lib/watchlistCustom';
import { getMergedWatchlistKR, getMergedWatchlistUS } from '../../lib/watchlist';

function watchlistPayload() {
  return {
    kr: getMergedWatchlistKR(),
    us: getMergedWatchlistUS(),
    custom: readCustomWatchlist(),
  };
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(watchlistPayload());
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const pin = process.env.WATCHLIST_ADMIN_PIN;
  if (!pin) {
    return res.status(503).json({ error: '관리자 PIN 미설정 (WATCHLIST_ADMIN_PIN)' });
  }

  const { action = 'add', adminPin, market, code, sym, label } = req.body || {};
  if (adminPin !== pin) {
    return res.status(403).json({ error: 'PIN이 올바르지 않습니다.' });
  }

  if (action === 'remove') {
    if (market === 'kr') {
      if (!/^\d{6}$/.test(String(code || ''))) {
        return res.status(400).json({ error: '6자리 종목코드가 필요합니다.' });
      }
      removeFromWatchlist({ market: 'kr', code: String(code) });
      return res.status(200).json({ ok: true, removed: true, ...watchlistPayload() });
    }
    if (market === 'us') {
      const ticker = String(sym || '').toUpperCase().trim();
      if (!/^[A-Z0-9.^=-]{1,12}$/.test(ticker)) {
        return res.status(400).json({ error: '티커가 올바르지 않습니다.' });
      }
      removeFromWatchlist({ market: 'us', sym: ticker });
      return res.status(200).json({ ok: true, removed: true, ...watchlistPayload() });
    }
    return res.status(400).json({ error: 'market은 kr 또는 us' });
  }

  if (market === 'kr') {
    if (!/^\d{6}$/.test(String(code || ''))) {
      return res.status(400).json({ error: '6자리 종목코드가 필요합니다.' });
    }
    const result = addToCustomWatchlist({
      market: 'kr',
      code: String(code),
      label: String(label || code).trim(),
    });
    if (!result.added) {
      return res.status(200).json({ ok: true, added: false, message: '이미 관심종목에 있습니다.' });
    }
    return res.status(200).json({ ok: true, added: true, ...watchlistPayload() });
  }

  if (market === 'us') {
    const ticker = String(sym || '').toUpperCase().trim();
    if (!/^[A-Z0-9.^=-]{1,12}$/.test(ticker)) {
      return res.status(400).json({ error: '티커가 올바르지 않습니다.' });
    }
    const result = addToCustomWatchlist({
      market: 'us',
      sym: ticker,
      label: String(label || ticker).trim(),
    });
    if (!result.added) {
      return res.status(200).json({ ok: true, added: false, message: '이미 관심종목에 있습니다.' });
    }
    return res.status(200).json({ ok: true, added: true, ...watchlistPayload() });
  }

  return res.status(400).json({ error: 'market은 kr 또는 us' });
}
