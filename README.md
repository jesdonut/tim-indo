# Tim Indo Serba Bisa

Internal browser tools for the team. No install needed, everything runs client-side.

## Pages

| Page | What it does |
|------|-------------|
| **PDF** | Merge PDFs and images (JPG/PNG), rotate pages, reorder, download |
| **Translate** | Japanese to EN/ID/etc. with romaji and kana |
| **Postal** | Japan postal code lookup: code to address or address to code |
| **Spell** | Type a katakana name, see how each character is said |
| **Compress** | Compress PDFs in the browser |
| **Station** | Find the nearest train station by postal code or address |
| **Builder** | Paste Excel columns and stitch them into strings row by row |

## Stack

Plain HTML/CSS/JS. No build step, no backend.

- PDF generation: [pdf-lib](https://pdf-lib.js.org/)
- Romaji/translation: Google Translate public endpoint
- Postal data: ken-all via numb86 CDN + geolonia addresses dataset
- Station data: HeartRails Express API (build-time), served as static JSON
- Hosting: Vercel (static)

## Deploy

Push to `main` and Vercel auto-deploys. Config in `vercel.json`.
