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

## Page layout rules

All app pages under `app/(app)/` must follow these rules unless a page has a specific reason to deviate (e.g. full-bleed map, fixed-height tool).

### Standard page (scrollable content)
```tsx
<div className="max-w-3xl mx-auto px-5 py-8">
  <div className="mb-8"> {/* or mb-6 */}
    <p className="label-xs mb-1">Section label</p>
    <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Page title</h1>
  </div>
  {/* content */}
</div>
```

### Narrow form page (profile, auth)
```tsx
<div className="flex justify-center min-h-[calc(100dvh-48px)] px-5 py-10">
  <div className="w-full max-w-sm flex flex-col gap-8">
    {/* content */}
  </div>
</div>
```

### Full-height tool page (PDF, Area)
- Outer shell: `h-[calc(100dvh-48px)] max-w-3xl mx-auto w-full flex flex-col`
- Page header sits at the top with `px-5 pt-8 pb-4` before the tool chrome
- Tool chrome (tabs, bottom bar) fills the remaining flex space

### Tokens
- **Max width**: `max-w-3xl` for all content pages, `max-w-sm` for forms
- **Horizontal padding**: `px-5` everywhere
- **Top padding**: `py-8` (standard), `pt-8` when bottom is fixed (full-height tools), `py-10` for forms
- **Page header spacing**: `mb-6` below the title before first content block
- **Section labels**: always `label-xs` (the utility class), never plain `text-xs uppercase`

## Deploy

Push to `main` on GitHub → Vercel auto-deploys. No manual steps needed.
