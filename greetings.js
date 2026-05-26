// ── Static jokes ─────────────────────────────────────────────────────────────
// Add or remove lines freely. {month} = current Indonesian month name.
// One is picked at random each session (blended with timed ones below).

var GREETINGS = [
  'Udah bulan {month} cepet juga ya 😅',
  'Dollar ga di pake di desa, ga di pake di Tokyo juga si 🤷',
  'Diskon di jalan toll… emang bisa? 😂',
  'Pak gunung naikin gaji kita pak 🙏',
  'Itu output jangan lupa ya, bisa di ganti / di tulis pak dan ibu ✍️',
];

// ── Timed greetings (Japan Standard Time, UTC+9) ──────────────────────────────
// Each entry needs:
//   condition: function(jst) → true/false
//     jst.hours      (0–23, JST)
//     jst.day        (0=Sun, 1=Mon, 2=Tue … 6=Sat)
//     jst.totalMins  (hours*60 + minutes, useful for ranges)
//     jst.timeStr    ("HH:MM" in JST, e.g. "09:05")
//   text: string — {time} is replaced with jst.timeStr, {month} with month name
//   priority: true → if condition matches, skips random pick entirely and shows this

var GREETINGS_TIMED = [
  {
    // Tuesday 11:30–12:30 JST — weekly meeting, always overrides random pick
    priority: true,
    condition: function(jst) { return jst.day === 2 && jst.totalMins >= 690 && jst.totalMins < 750; },
    text: 'meeting bentar lagi pak bu! 📅'
  },
  {
    // Before noon JST
    condition: function(jst) { return jst.hours < 12; },
    text: 'pagi-pagi sudah dipakai juga app nya 🌅'
  },
  {
    // 6 PM or later JST
    condition: function(jst) { return jst.hours >= 18; },
    text: 'lembur lagi dah — ini tim lembur bukan tim indonesia 😭'
  },
  {
    // Always — shows current Japan time as a nudge to take a break
    condition: function(jst) { return true; },
    text: 'jangan lupa istirahat ya, udah jam {time} 🕐'
  },
];
