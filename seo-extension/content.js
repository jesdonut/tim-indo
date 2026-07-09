;(function () {
  var keyword = new URLSearchParams(location.search).get('keyword') || ''
  var sent    = false

  // Walk the DOM in order, capturing text nodes and <input> values
  // (aramakijake renders volumes into readonly inputs, invisible to innerText)
  function getFullText() {
    var parts = []
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var t = (node.textContent || '').trim()
        if (t) parts.push(t)
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        var tag = node.nodeName.toUpperCase()
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          var v = (node.value || '').trim()
          if (v) parts.push(v)
          return
        }
        for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i])
      }
    }
    walk(document.body)
    return parts.join(' ').replace(/\s+/g, ' ')
  }

  function extract() {
    var text = getFullText()

    // Numbers appear between these two markers.
    // Yahoo label and Google label are images, so we can't look for that text —
    // but order is always: first number = Yahoo, second number = Google.
    var START = '月間推定検索数'
    var END   = 'SEOツール'

    var si = text.indexOf(START)
    if (si === -1) return { yahoo: null, google: null }

    var section = text.slice(si + START.length)
    var ei = section.indexOf(END)
    if (ei !== -1) section = section.slice(0, ei)

    var nums = (section.match(/[\d,]+/g) || [])
      .map(function (s) { return parseInt(s.replace(/,/g, ''), 10) })
      .filter(function (n) { return !isNaN(n) && n >= 0 })

    return {
      yahoo:  nums.length > 0 ? nums[0] : null,
      google: nums.length > 1 ? nums[1] : null,
    }
  }

  function noDataOnPage(text) {
    return /データ(が|は)?(見つかり|ありません|取得できません)|検索結果(が|は)?ありません/i.test(text)
  }

  function sendResult(yahoo, google) {
    if (sent) return
    sent = true
    observer.disconnect()
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'aramaki-result', keyword: keyword, yahoo: yahoo, google: google },
          '*'
        )
      } catch (_) {}
    }
  }

  function tryExtract() {
    if (sent) return
    var text = getFullText()
    if (noDataOnPage(text)) { sendResult(null, null); return }
    var r = extract()
    if (r.yahoo !== null || r.google !== null) sendResult(r.yahoo, r.google)
  }

  var observer = new MutationObserver(function () { tryExtract() })

  setTimeout(function () {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    tryExtract()
    setTimeout(function () {
      observer.disconnect()
      if (!sent) sendResult(null, null)
    }, 20000)
  }, 800)
})()
