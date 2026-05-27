// ── Static jokes ─────────────────────────────────────────────────────────────
// Add or remove lines freely. {month} = current Indonesian month name.
// One is picked at random each session (blended with timed ones below).

var GREETINGS = [
  'udah bulan {month} ges, cepet bet hidup ini 😵‍💫',
  'yen lagi lemah, kita yang harus kuat 💪',
  'pak gunung tolong naikin gaji kita pak 🙏',
  'dollar naik lagi... yaudahlah rezeki ada aja 😮‍💨',
  'tim indo serba bisa, literally 💅',
  'kalau bosen, refresh aja. tapi tolong kerjaannya kelar dulu ya 🫡',
  'udah makan belum? jangan sampe lupa makan gegara kerja 🍱',
  'gaskeun dulu kerjaannya biar bisa ngopi tenang ☕',
  'hari ini fix produktif ya, no excuse 😤',
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
    text: 'ges meeting bentar lagi! jangan telat ya 📅'
  },
  {
    // Before noon JST
    condition: function(jst) { return jst.hours < 12; },
    text: 'pagi-pagi udah gaskeun? sabi sih 🌅'
  },
  {
    // 6 PM or later JST
    condition: function(jst) { return jst.hours >= 18; },
    text: 'lembur lagi cuy? yaudah gue temenin deh 😭'
  },
  {
    // Friday afternoon — weekend vibes
    condition: function(jst) { return jst.day === 5 && jst.hours >= 15; },
    text: 'weekend sebentar lagi ges, tahan dulu 🎉'
  },
  {
    // Always — shows current Japan time
    condition: function(jst) { return true; },
    text: 'udah jam {time} di jepang, jangan lupa napas ya 🕐'
  },
];
