# macro-dashboard

Next.js 15 (Pages Router) app: a Korean-language real-time macro liquidity + global equity dashboard. UI is `pages/index.js`; backend is the `pages/api/*` route handlers. There is no database — the only persistence is `data/custom-watchlist.json`.

## Cursor Cloud specific instructions

- Standard commands live in `package.json`: `npm run dev` (dev server on http://localhost:3000), `npm run build`, `npm run start`.
- There is **no lint config and no test framework** in this repo (no `lint`/`test` scripts, no ESLint config, no test files). Don't expect `npm test`/`npm run lint` to work.
- All data is fetched **live at request time** from external public APIs (Yahoo Finance, Naver Finance, FRED, Forex Factory, TradingView). Outbound internet is required for the dashboard to populate; with no network, panels render empty.
- Optional env vars (template in `.env.example`, copy to `.env`):
  - `FRED_API_KEY` — only needed for the FED liquidity panel and FRED macro events (`/api/liquidity`, part of `/api/events`). Without it `/api/liquidity` returns 500 and the bottom "liquidity / economic indicators" sections render empty; the rest of the dashboard (quotes, charts, news, earnings) works fine.
  - `WATCHLIST_ADMIN_PIN` — only needed for server-side watchlist add/remove (`/api/watchlist` POST/DELETE return 503 without it). GET and the client-side localStorage watchlist work without it.
- Quick smoke test without a browser: `curl localhost:3000/api/stock` and `curl localhost:3000/api/news` should return live JSON.
