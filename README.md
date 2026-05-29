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
| **Area** | Interactive Japan prefecture map — assign areas to staff, track worker rosters, CSV/JSON import-export |

## Stack

Plain HTML/CSS/JS. No build step, no backend.

- PDF generation: [pdf-lib](https://pdf-lib.js.org/)
- Romaji/translation: Google Translate public endpoint
- Postal data: ken-all via numb86 CDN + geolonia addresses dataset
- Station data: HeartRails Express API (build-time), served as static JSON
- Map rendering: [D3](https://d3js.org/) + [topojson-client](https://github.com/topojson/topojson-client), map data from [dataofjapan/land](https://github.com/dataofjapan/land)
- Hosting: Vercel (static)

## Deploy

Push to `main` and Vercel auto-deploys. Config in `vercel.json`.

## Ownership & Usage

This is a **personal project**, built entirely on personal time, personal hardware, and personally paid tools and subscriptions. It is not affiliated with, owned by, or developed on behalf of any employer or organization.

**This project is not open source.** No license is granted — you may not use, copy, modify, or distribute any part of this code without explicit written permission from the author.

&copy; Jessica. All rights reserved.
