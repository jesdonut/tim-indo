# Tim Indo Serba Bisa

Private internal tools for a small Indonesia-based team working in Japan. Requires an invite to sign up.

## Tools

| Page | What it does |
|------|-------------|
| **Database** | Shared team data viewer |
| **PDF** | Merge, compress, and package document sets (在留カード etc.) |
| **Builder** | Paste Excel columns, stitch them into strings row by row with formula columns |
| **Area** | Interactive Japan prefecture map — assign areas to staff, track worker rosters, CSV/JSON import-export |
| **Extract** | Name spelling (katakana→spell / romaji), phone-number reading, Leopalace guidebook extract, and phone-number extraction from text |

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth & DB:** Supabase (auth, realtime, row-level security)
- **PDF:** [pdf-lib](https://pdf-lib.js.org/), [PDF.js](https://mozilla.github.io/pdf.js/)
- **Map:** [D3](https://d3js.org/) + [topojson-client](https://github.com/topojson/topojson-client), map data from [dataofjapan/land](https://github.com/dataofjapan/land)
- **Drag-and-drop:** [@dnd-kit](https://dndkit.com/)
- **Hosting:** Vercel (auto-deploy on push to `main`)

## Dev

```bash
npm install
npm run dev
```

Requires `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=...
INVITE_CODE=...
```

## Deploy

Push to `main` → Vercel auto-deploys. No manual steps.

## Ownership & Usage

This is a **personal project**, built entirely on personal time, personal hardware, and personally paid tools and subscriptions. It is not affiliated with, owned by, or developed on behalf of any employer or organization.

**This project is not open source.** No license is granted — you may not use, copy, modify, or distribute any part of this code without explicit written permission from the author.

&copy; Jessica. All rights reserved.
