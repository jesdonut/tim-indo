# Project: Tim Indo Serba Bisa — Team Tools

Private internal tool for a small team. Plain HTML/CSS/JS, no build step, deployed on Vercel.

## Pages

- `index.html` — PDF merger (main page)
- `translate.html` — Japanese translator
- `postal.html` — Japan postal code lookup

## Adding team greeting jokes

All greeting content lives in `greetings.js`. There are two sections:

**Static jokes** (`GREETINGS` array) — add a string, gets randomly picked each session.
- `{month}` → current Indonesian month name
- `{time}` → current Japan time (HH:MM)
- Example: `'Pak gunung naikin gaji kita pak 🙏',`

**Timed greetings** (`GREETINGS_TIMED` array) — shown based on Japan time (JST/UTC+9).
Each entry has a `condition(jst)` function and a `text` string.
- `jst.hours` (0–23), `jst.day` (0=Sun…6=Sat), `jst.totalMins` (hours×60+min)
- Add `priority: true` to override the random pick entirely when condition matches
- Example (Friday afternoon):
  ```js
  { condition: function(jst) { return jst.day === 5 && jst.hours >= 15; },
    text: 'weekend sebentar lagi 🎉' }
  ```

**USD→IDR rate** — fetched automatically (cdn.jsdelivr.net, no API key), cached 1 hour.
Format: "sekarang rate-nya 17ribu jir 💸 (USD→IDR)". No edits needed.

The greeting prefix is always: **"Hi, welcome back Dimas, Jessica & Ben —"**
Shows once per browser session; dismissed with ×.

## Personal info policy

- Do not add real emails, phone numbers, or external personal URLs to any HTML file
- Team member first names (Dimas, Jessica, Ben) are intentionally in `greetings.js` — that's fine
- No API keys anywhere — all APIs used are public/unauthenticated

## Deploy

Push to `main` on GitHub → Vercel auto-deploys. No manual steps needed.
