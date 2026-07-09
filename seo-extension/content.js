;(function () {
  var MAX_ATTEMPTS = 12
  var RETRY_MS     = 700

  function getKeyword() {
    return new URLSearchParams(location.search).get('keyword') || ''
  }

  function extract() {
    var text = (document.body.innerText || '').replace(/\s+/g, ' ')
    var google = null
    var yahoo  = null

    // Split on each Google/Yahoo marker and grab the first number after it
    var segs = text.split(/(?=(?:Google|グーグル|Yahoo|ヤフー))/i)
    for (var i = 0; i < segs.length; i++) {
      var local = segs[i].slice(0, 200)
      var matches = local.match(/[\d,]{2,}/g)
      if (!matches) continue
      var nums = matches
        .map(function (n) { return parseInt(n.replace(/,/g, ''), 10) })
        .filter(function (n) { return n > 0 })
      if (!nums.length) continue
      if (/Google|グーグル/i.test(local) && google === null) google = nums[0]
      if (/Yahoo|ヤフー/i.test(local)   && yahoo  === null) yahoo  = nums[0]
    }

    return { keyword: getKeyword(), google: google, yahoo: yahoo }
  }

  function trySend(attempts) {
    var result = extract()

    if (result.google !== null || result.yahoo !== null) {
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'aramaki-result', keyword: result.keyword, google: result.google, yahoo: result.yahoo },
            '*'
          )
        } catch (e) {}
      }
      return
    }

    // Numbers not in DOM yet — page JS may still be rendering
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(function () { trySend(attempts + 1) }, RETRY_MS)
    }
  }

  // Give the page's own JS time to render before first attempt
  setTimeout(function () { trySend(0) }, 1200)
})()
