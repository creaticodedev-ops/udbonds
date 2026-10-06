# US Bonds

Website for US Bonds — gold trading, investment opportunities, trading education and market analysis.

**Phase 1:** public landing page with a live XAU/USD market terminal and a registration request form (no accounts, dashboards or payments). Local development only.

## Structure

| Folder | Purpose |
| --- | --- |
| `client/` | Landing page — Vite + React, plain CSS design system (black · white · green), FR / EN / AR (RTL) |
| `server/` | Express API + MongoDB (market data proxy, registration requests) |
| `scripts/dev.mjs` | Starts both for local development |

## Getting started

Requirements: Node.js 20+, MongoDB running locally (MongoDB Compass can connect to the same URI).

```bash
npm run setup                          # installs client/ and server/ dependencies
copy server\.env.example server\.env   # Windows (cp on macOS/Linux)
npm run dev
```

- Website: http://localhost:3000
- API health check: http://localhost:3000/api/health (proxied to the API on port 5000)

Other scripts: `npm run build`, `npm run lint`, `npm run dev:client`, `npm run dev:server`.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | API and database status |
| `GET /api/market/instruments` | Instrument catalogue (metals, forex, indices, stocks, commodities, crypto, bonds) |
| `GET /api/market/quote?symbol=` | Live quote (bid, ask, spread, session open / high / low, previous close) — `symbol` defaults to `XAUUSD` |
| `GET /api/market/candles?symbol=&tf=` | OHLCV candles — `tf` is one of `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, `1w` |
| `GET /api/market/overview?category=` or `?ids=` | Watchlist rows: price, change versus previous close, 24-hour sparkline |
| `GET /api/news?lang=` | Latest financial headlines (`fr`, `en` or `ar`), newest first, deduplicated |
| `POST /api/registrations` | Registration request (`offer`, `firstName`, `lastName`, `city`, `amount`, `duration` = `15d` or `1m`, `locale`) |

The catalogue lives in `server/services/instruments.js` (Dukascopy code, precision, currency). Market data comes from public, unauthenticated feeds, cached and throttled server-side:

- Real-time quotes: Swissquote public quotes feed for metals and forex, Dukascopy public tick feed for indices, stocks, commodities, crypto and bonds.
- Candles and history: Dukascopy public chart feed (bid side). The current bar is rebuilt from 1-minute data.
- Headlines: public RSS feeds from Investing.com (forex, commodities, stocks, crypto, economy — in French, English and Arabic), plus FXStreet and investingLive in English. Each feed is refreshed at most once a minute; headlines link to the original articles.

These feeds are not officially documented and carry no availability guarantee. Use a licensed market-data provider before any public launch.

Registration requests are stored in the `registrations` collection (status `new` / `contacted` / `closed`). The endpoint is rate limited to 5 requests per 10 minutes per IP.

## Configuration

`server/.env`

| Variable | Default |
| --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/udbonds` |
| `PORT` | `5000` |

`client/.env` (optional — empty values are not displayed)

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Public site URL |
| `VITE_CONTACT_EMAIL` | Contact e-mail (used by "Nous contacter") |
| `VITE_CONTACT_PHONE` | Contact phone |
| `VITE_CONTACT_WHATSAPP` | WhatsApp number |
| `VITE_COMPANY_ADDRESS` | Company address |

The `udbonds` database and its `registrations` collection appear in MongoDB Compass once the first registration request is submitted.

## Content

- Translations: `client/src/i18n/dictionaries/{fr,en,ar}.js`
- Offer levels (placeholders, no figures): `client/src/config/offers.js`
- Landing sections: `client/src/landing/sections/`
- Market terminal: `client/src/market/` (charts by TradingView Lightweight Charts™)
- Reviews carousel: `reviews.items` in the dictionaries — the current entries are illustrative placeholders, labelled as such on the page, and must be replaced with real, verifiable reviews
- Brand assets: `npm run brand:assets --prefix client` regenerates the trimmed logo, favicons and social image from `client/brand/usbonds-logo-official.png`
