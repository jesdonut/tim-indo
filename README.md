# Grasp Agent Japan — Team Tools

Internal browser tools for the team. No install needed — everything runs client-side.

## Pages

| Page | What it does |
|------|-------------|
| **PDF** | Merge PDFs & images (JPG/PNG), rotate pages, reorder, download |
| **Translate** | Japanese → EN/ID/etc. with romaji and kana |
| **Postal** | Japan 〒 lookup — code → address or address → code |

## Stack

Plain HTML/CSS/JS. No build step, no backend.

- PDF generation: [pdf-lib](https://pdf-lib.js.org/)
- Romaji/translation: Google Translate public endpoint
- Postal data: [zipcloud](https://zipcloud.ibsnet.co.jp/) + OpenStreetMap Nominatim
- Hosting: Vercel (static)

## Deploy

Push to `main` → Vercel auto-deploys. Config in `vercel.json`.
