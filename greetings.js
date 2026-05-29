document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

// ── Version ───────────────────────────────────────────────────────────────────
var APP_VERSION = 'v1.52';
var APP_STAGE   = 'beta';

// ── Static jokes ─────────────────────────────────────────────────────────────
var GREETINGS = [
  'udah bulan {month} ges, cepet bet hidup ini 😵‍💫',
  'idr lagi lemah, kita yang harus kuat 💪',
  'pak gunung tolong naikin gaji kita pak 🙏',
  'dollar naik lagi... yaudahlah rezeki ada aja 😮‍💨',
  'tim indo serba bisa, literally 💅',
  'kalau bosen, refresh aja. tapi tolong kerjaannya kelar dulu ya 🫡',
  'udah makan belum? jangan sampe lupa makan gegara kerja 🍱',
  'gaskeun dulu kerjaannya biar bisa ngopi tenang ☕',
  'hari ini fix produktif ya, no excuse 😤',
  'konbini deket kantor masih jadi penyelamat hidup 🙌',
  'indomie di tokyo harganya berapa ya... nanya buat temen 🍜',
  'jajan di jepang murah asal jangan liat kursnya dulu 💀',
  'otsukaresama deshita! eh salah channel 😂',
  'itterasshai~ eh ini bukan group jepang 😅',
  'yoroshiku onegaishimasu 🙇 — eh maksudnya tolong ya ges',
  'sumimasen sumimasen... eh salah chat lagi 🙏',
  'itadakimasu! 🍱 — sorry kirim ke group yang salah',
  'nasi padang di tokyo kapan buka cabang ya 😭',
  'yang penting WF — work finished 🫡',
  'JPY sama IDR kompak sama-sama struggle, kita yang harus kuat 🤝',
  'fun fact: kalau kereta jepang telat 20 detik aja mereka minta maaf resmi. 20. detik. kita kalau telat meeting... 😭',
  'fun fact: jepang punya lebih banyak vending machine per orang daripada negara mana pun. termasuk vending machine beras 🍚',
  'fun fact: 7-eleven di jepang lebih banyak dari di amrik — negara yang nyiptainnya 🏪',
  'fun fact: indonesia punya 17.000+ pulau dan kita milih kerja di jepang 🫡',
  'fun fact: komodo dragon cuma ada di indonesia. kita asalnya dari negara yang punya dragon beneran 🐉',
  'fun fact: bahasa indonesia diciptain tahun 1928 supaya semua suku bisa ngobrol. sekarang dipake buat ngomongin deadline 😂',
  'fun fact: otak manusia bisa fokus maksimal sekitar 90 menit. artinya istirahat itu ilmiah, bukan males 🧠',
  'fun fact: rata-rata orang buka Line kerja 15x sehari. dan tetep ngerasa belum bales semua 📱',
  'fun fact: kopi adalah komoditi paling banyak diperdagangkan setelah minyak. jadi minum kopi itu literally investasi ☕',
  '"xin chào!" 🇻🇳 gitu cara bilang halo dalam bahasa vietnam (baca: sin chao). ilmu gratis hari ini!',
  '"mingalabar!" 🇲🇲 cara bilang halo dalam bahasa myanmar. kedengarannya cool kan',
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
    // Friday all day — language trivia
    condition: function(jst) { return jst.day === 5 && jst.hours < 15; },
    text: 'ini friday bukan? "thứ Sáu" (tu-sau) itu artinya jumat dalam bahasa vietnam btw 🇻🇳🎉'
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
      '.greeting-close:hover{color:var(--text)}' +
      '.version-badge{display:inline-block;margin-left:6px;font-size:0.55rem;' +
      'padding:1px 5px;border-radius:3px;background:rgba(255,255,255,0.18);' +
      'color:rgba(255,255,255,0.8);letter-spacing:0.04em;vertical-align:middle}';
    document.head.appendChild(style);

    var brandJa = document.querySelector('.brand-ja');
    if (brandJa) {
      var badge = document.createElement('span');
      badge.className = 'version-badge';
      badge.textContent = APP_VERSION + ' · ' + APP_STAGE;
      brandJa.appendChild(badge);
    }

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
      var last = sessionStorage.getItem('gaj_last_joke');
      var filtered = pool.filter(function(j) { return j !== last; });
      var candidates = filtered.length ? filtered : pool;
      var joke = (timedPool.length && Math.random() < 0.6) ? pick(timedPool) : pick(candidates);
      sessionStorage.setItem('gaj_last_joke', joke);
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
