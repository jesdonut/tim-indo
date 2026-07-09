;(function () {
  var keyword = new URLSearchParams(location.search).get('keyword') || ''
  var sent    = false

  function firstVolume(str) {
    // Strip copyright / date patterns before extracting numbers
    var cleaned = str.replace(/(?:copyright|©|all\s+rights?|co\.,?\s*ltd\.?)[\s\S]{0,30}/gi, ' ')
    var nums = (cleaned.match(/[\d,]+/g) || [])
      .map(function (s) { return parseInt(s.replace(/,/g, ''), 10) })
      .filter(function (n) { return !isNaN(n) && n >= 10 && n < 100000000 })
    return nums.length ? nums[0] : null
  }

  function scanText(text) {
    var google = null, yahoo = null
    var segs = text.split(/(?=(?:Google|グーグル|Yahoo|ヤフー))/i)
    for (var i = 0; i < segs.length; i++) {
      var local = segs[i].slice(0, 200)
      var vol = firstVolume(local)
      if (vol === null) continue
      if (/Google|グーグル/i.test(local) && google === null) google = vol
      if (/Yahoo|ヤフー/i.test(local)   && yahoo  === null) yahoo  = vol
    }
    return { google: google, yahoo: yahoo }
  }

  function getFullText() {
    var base = (document.body.innerText || '').replace(/\s+/g, ' ')
    // Also read <input> values — aramakijake uses readonly inputs for volumes
    var extra = ''
    var inputs = document.querySelectorAll('input, textarea')
    for (var i = 0; i < inputs.length; i++) {
      var val = (inputs[i].value || '').trim()
      if (!val || val.length > 30) continue
      var ctx = inputs[i].parentElement ? (inputs[i].parentElement.innerText || '') : ''
      extra += ' ' + ctx + ' ' + val + ' '
    }
    return (base + ' ' + extra).replace(/\s+/g, ' ')
  }

  function noDataOnPage(text) {
    return /データ(が|は)?(見つかり|ありません|取得できません)|検索結果(が|は)?ありません|no[\s\-]?data/i.test(text)
  }

  function sendResult(google, yahoo) {
    if (sent) return
    sent = true
    observer.disconnect()
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'aramaki-result', keyword: keyword, google: google, yahoo: yahoo },
          '*'
        )
      } catch (_) {}
    }
  }

  function tryExtract() {
    if (sent) return
    var text = getFullText()

    if (noDataOnPage(text)) {
      sendResult(null, null)
      return
    }

    // Prefer numbers from the 月間 (monthly search) section
    var monthMatch = text.match(/月間[\s\S]{0,800}/i)
    if (monthMatch) {
      var r1 = scanText(monthMatch[0])
      if (r1.google !== null || r1.yahoo !== null) { sendResult(r1.google, r1.yahoo); return }
    }

    // Full-page fallback
    var r2 = scanText(text)
    if (r2.google !== null || r2.yahoo !== null) { sendResult(r2.google, r2.yahoo); return }
  }

  // MutationObserver fires as soon as the DOM updates — no fixed polling delay
  var observer = new MutationObserver(function () { tryExtract() })

  setTimeout(function () {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    tryExtract() // try immediately too

    // Hard stop after 20 s — send null so the SEO page can move on
    setTimeout(function () {
      observer.disconnect()
      if (!sent) sendResult(null, null)
    }, 20000)
  }, 800)
})()
