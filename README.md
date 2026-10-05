# U.D.Bonds

Public website for U.D.Bonds — gold trading, investment opportunities, trading education and market analysis.

**Phase 1:** landing page only (no accounts, dashboards, payments or backend features).

## Front-end (`client/`)

- Vite + React, plain CSS design system (black · white · green)
- French (default), English and Arabic (RTL)

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

### Configuration

Copy `client/.env.example` to `client/.env`. All values are optional; empty values are not displayed.

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Public site URL |
| `VITE_CONTACT_EMAIL` | Contact e-mail (also used by "Contact us" / "Stay informed" buttons) |
| `VITE_CONTACT_PHONE` | Contact phone |
| `VITE_CONTACT_WHATSAPP` | WhatsApp number |
| `VITE_COMPANY_ADDRESS` | Company address |

### Content

- Translations: `client/src/i18n/dictionaries/{fr,en,ar}.js`
- Offer levels (placeholder, no figures): `client/src/config/offers.js`
- Brand assets: `npm run brand:assets` regenerates the trimmed logo, favicons and social image from `client/brand/udbonds-logo-official.png`
