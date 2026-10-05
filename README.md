# US Bonds

Website for US Bonds — gold trading, investment opportunities, trading education and market analysis.

**Phase 1:** public landing page only (no accounts, dashboards, payments or business logic). Local development only.

## Structure

| Folder | Purpose |
| --- | --- |
| `client/` | Landing page — Vite + React, plain CSS design system (black · white · green), FR / EN / AR (RTL) |
| `server/` | Minimal Express API + MongoDB connection (technical foundation for future phases) |
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
| `VITE_CONTACT_EMAIL` | Contact e-mail (used by "Nous contacter" / "Être informé") |
| `VITE_CONTACT_PHONE` | Contact phone |
| `VITE_CONTACT_WHATSAPP` | WhatsApp number |
| `VITE_COMPANY_ADDRESS` | Company address |

The `udbonds` database appears in MongoDB Compass once the first document is written (future phases); no collections are created in Phase 1.

## Content

- Translations: `client/src/i18n/dictionaries/{fr,en,ar}.js`
- Offer levels (placeholders, no figures): `client/src/config/offers.js`
- Landing sections: `client/src/landing/sections/`
- Brand assets: `npm run brand:assets --prefix client` regenerates the trimmed logo, favicons and social image from `client/brand/usbonds-logo-official.png`
