# Project: Grasp Agent Japan — Team Tools

Private internal tool for a small team. Plain HTML/CSS/JS, no build step, deployed on Vercel.

## Pages

- `index.html` — PDF merger (main page)
- `translate.html` — Japanese translator
- `postal.html` — Japan postal code lookup

## Adding team greeting jokes

Jokes live in `greetings.js`. To add one, open that file and append a string to the `GREETINGS` array.

- Use `{month}` anywhere in the string to insert the current Indonesian month name
- The greeting prefix is always: **"Hi, welcome back Dimas, Jessica & Ben —"**
- Example line: `'Udah bulan {month}, cepet juga ya 😅',`

The greeting shows once per browser session and the user can dismiss it.

## Personal info policy

- Do not add real emails, phone numbers, or external personal URLs to any HTML file
- Team member first names (Dimas, Jessica, Ben) are intentionally in `greetings.js` — that's fine
- No API keys anywhere — all APIs used are public/unauthenticated

## Deploy

Push to `main` on GitHub → Vercel auto-deploys. No manual steps needed.
