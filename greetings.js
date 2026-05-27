// ── Static jokes ─────────────────────────────────────────────────────────────
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
var GREETINGS_TIMED = [
  {
    // Tuesday 11:30–12:30 JST — weekly meeting
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
    // 3pm–9pm JST — prime break + end-of-work hours
    condition: function(jst) { return jst.hours >= 15 && jst.hours < 21; },
    text: 'udah jam {time}, jangan lupa istirahat ya 🕐'
  },
  {
    // After 9pm JST — actually late
    condition: function(jst) { return jst.hours >= 21; },
    text: 'lembur lagi cuy? yaudah gue temenin deh 😭'
  },
  {
    // Friday afternoon — weekend vibes
    condition: function(jst) { return jst.day === 5 && jst.hours >= 15; },
    text: 'weekend sebentar lagi ges, tahan dulu 🎉'
  },
  {
    // Always fallback
    condition: function(jst) { return true; },
    text: 'semangat ya ges, kalian bisa 💪'
  },
];

// ── Auto-inject greeting bar into any page with a .mid div ────────────────────
(function() {
  var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                'September','Oktober','November','Desember'];

  function getJST() {
    var d = new Date(Date.now() + 9 * 3600000);
    var h = d.getUTCHours(), m = d.getUTCMinutes();
    return { hours: h, day: d.getUTCDay(), totalMins: h*60+m,
             timeStr: ('0'+h).slice(-2)+':'+('0'+m).slice(-2) };
  }

  function applyVars(text, jst) {
    return text.replace('{month}', MONTHS[new Date().getMonth()])
               .replace('{time}', jst.timeStr);
  }

  function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

  function injectBar() {
    if (document.getElementById('greetingBar')) return; // already in HTML

    var style = document.createElement('style');
    style.textContent =
      '.greeting-bar{background:var(--mid);border:1px solid var(--border-soft);' +
      'border-radius:9px;padding:8px 13px;display:flex;align-items:center;' +
      'justify-content:space-between;font-size:.78rem;color:var(--text);flex-shrink:0}' +
      '.greeting-text{flex:1}' +
      '.greeting-close{background:none;border:none;color:var(--muted);cursor:pointer;' +
      'font-size:1.1rem;line-height:1;padding:0 0 0 10px;flex-shrink:0}' +
      '.greeting-close:hover{color:var(--text)}';
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'greeting-bar';
    bar.id = 'greetingBar';
    bar.style.display = 'none';
    var txt = document.createElement('span');
    txt.className = 'greeting-text';
    txt.id = 'greetingText';
    var btn = document.createElement('button');
    btn.className = 'greeting-close';
    btn.title = 'Tutup';
    btn.innerHTML = '&#215;';
    btn.onclick = function() { bar.style.display = 'none'; };
    bar.appendChild(txt);
    bar.appendChild(btn);

    var mid = document.querySelector('.mid');
    if (!mid) return;
    var appTitle = mid.querySelector('.app-title');
    mid.insertBefore(bar, appTitle ? appTitle.nextSibling : mid.firstChild);
  }

  function getCached() {
    try {
      var d = JSON.parse(localStorage.getItem('gaj_rate') || 'null');
      return (d && Date.now() - d.ts < 3600000) ? d.val : null;
    } catch(e) { return null; }
  }

  function fetchRate() {
    return fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var idr = d && d.usd && d.usd.idr;
        if (!idr) return null;
        var k = Math.round(idr/100)/10;
        var fmt = (k%1===0 ? k.toString() : k.toFixed(1))+'ribu';
        var joke = 'sekarang rate-nya '+fmt+' jir 💸 (USD→IDR)';
        try { localStorage.setItem('gaj_rate', JSON.stringify({val:joke,ts:Date.now()})); } catch(e) {}
        return joke;
      }).catch(function() { return null; });
  }

  function runGreeting() {
    injectBar();

    var jst = getJST();

    for (var i = 0; i < GREETINGS_TIMED.length; i++) {
      var g = GREETINGS_TIMED[i];
      if (g.priority && g.condition(jst)) {
        showText(applyVars(g.text, jst));
        return;
      }
    }

    var timedPool = GREETINGS_TIMED
      .filter(function(g) { return !g.priority && g.condition(jst); })
      .map(function(g)   { return applyVars(g.text, jst); });
    var staticPool = GREETINGS.map(function(t) { return applyVars(t, jst); });

    var cached = getCached();
    var ratePromise = cached
      ? Promise.resolve(cached)
      : Promise.race([
          fetchRate(),
          new Promise(function(res) { setTimeout(function() { res(null); }, 900); })
        ]);

    ratePromise.then(function(rateJoke) {
      var pool = timedPool.concat(staticPool);
      if (rateJoke) pool.push(rateJoke);
      var joke = (timedPool.length && Math.random() < 0.6) ? pick(timedPool) : pick(pool);
      showText(joke);
    });
  }

  function showText(joke) {
    var el  = document.getElementById('greetingText');
    var bar = document.getElementById('greetingBar');
    if (!el || !bar) return;
    el.textContent = 'Halo Dimas, Jessica & Ben! ' + joke;
    bar.style.display = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGreeting);
  } else {
    runGreeting();
  }
})();

function dismissGreeting() {
  var bar = document.getElementById('greetingBar');
  if (bar) bar.style.display = 'none';
}
