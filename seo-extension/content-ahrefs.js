;(function () {
  // Keyword from URL — Ahrefs uses ?keyword= in keywords-explorer
  var keyword = new URLSearchParams(location.search).get('keyword') ||
                new URLSearchParams(location.search).get('keywords') || ''
  var sent = false

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

  function extractKD() {
    var text = getFullText()

    // Ahrefs shows KD as a 0–100 number near the "KD" label in the overview panel
    var patterns = [
      /\bKD\b\s*(\d{1,3})\b/,
      /[Kk]eyword\s*[Dd]ifficulty\s*(\d{1,3})\b/,
    ]
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i])
      if (m) {
        var kd = parseInt(m[1], 10)
        if (kd >= 0 && kd <= 100) return kd
      }
    }
    return null
  }

  function sendResult(kd) {
    if (sent) return
    sent = true
    observer.disconnect()
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'ahrefs-result', keyword: keyword, kd: kd },
          '*'
        )
      } catch (_) {}
    }
  }

  function tryExtract() {
    if (sent) return
    var kd = extractKD()
    if (kd !== null) sendResult(kd)
  }

  var observer = new MutationObserver(function () { tryExtract() })

  // Ahrefs is a SPA — give it more time before first attempt
  setTimeout(function () {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    tryExtract()
    // Hard stop after 30s — send null so tool moves on
    setTimeout(function () {
      observer.disconnect()
      if (!sent) sendResult(null)
    }, 30000)
  }, 3000)
})()
