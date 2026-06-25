import {
  searchSymbolSuggestions,
  getDefaultSymbolSuggestions,
  watchlistToCatalog,
} from '../../lib/symbolResolver';

function parseLimit(raw, fallback = 20) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(60, Math.max(1, n));
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const input = req.method === 'POST' ? (req.body ?? {}) : req.query;
  const q = String(input.q || '').trim();
  const all = input.all === '1' || input.all === true || input.all === 'true';
  const limit = parseLimit(input.limit, 20);
  const extra = watchlistToCatalog(input.extraKr || [], input.extraUs || []);

  const suggestions = all && !q
    ? getDefaultSymbolSuggestions(limit, extra)
    : searchSymbolSuggestions(q, limit, extra);

  return res.status(200).json({ q, suggestions });
}

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
