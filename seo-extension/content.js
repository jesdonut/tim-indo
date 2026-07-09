;(function () {
  var MAX_ATTEMPTS = 15
  var RETRY_MS     = 800

  function getKeyword() {
    return new URLSearchParams(location.search).get('keyword') || ''
  }

  function firstVolume(str) {
    var nums = (str.match(/[\d,]+/g) || [])
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

  function extract() {
    var keyword = getKeyword()

    // Base text from rendered DOM
    var baseText = (document.body.innerText || '').replace(/\s+/g, ' ')

    // Also grab values from <input> elements — aramakijake may use readonly inputs
    // Include the parent element's text as context so Google/Yahoo label travels with the value
    var extraText = ''
    var inputs = document.querySelectorAll('input, textarea')
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i]
      var val = (inp.value || '').trim()
      if (!val || val.length > 30) continue
      var ctx = inp.parentElement ? (inp.parentElement.innerText || inp.parentElement.textContent || '') : ''
      extraText += ' ' + ctx + ' ' + val + ' '
    }

    var fullText = (baseText + ' ' + extraText).replace(/\s+/g, ' ')

    // Strategy 1: look inside the 月間 (monthly search) section — most precise
    var monthMatch = fullText.match(/月間[\s\S]{0,800}/i)
    if (monthMatch) {
      var r1 = scanText(monthMatch[0])
      if (r1.google !== null || r1.yahoo !== null)
        return { keyword: keyword, google: r1.google, yahoo: r1.yahoo }
    }

    // Strategy 2: full-page scan
    var r2 = scanText(fullText)
    return { keyword: keyword, google: r2.google, yahoo: r2.yahoo }
  }

  function trySend(attempts) {
    var res = extract()
    if (res.google !== null || res.yahoo !== null) {
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'aramaki-result', keyword: res.keyword, google: res.google, yahoo: res.yahoo },
            '*'
          )
        } catch (_) {}
      }
      return
    }
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(function () { trySend(attempts + 1) }, RETRY_MS)
    }
  }

  // Give page JS extra time to render before first attempt
  setTimeout(function () { trySend(0) }, 1500)
})()
