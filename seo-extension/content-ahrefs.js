;(function () {
  // URL uses ?input= for the keyword
  var keyword = new URLSearchParams(location.search).get('input') || ''
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

    // KD appears right after the "SERP & KD" heading
    var marker = 'SERP & KD'
    var idx = text.indexOf(marker)
    if (idx === -1) return null

    // Look at the next ~150 chars for the first number 0–100
    var section = text.slice(idx + marker.length, idx + marker.length + 150)
    var m = section.match(/\b(\d{1,3})\b/)
    if (m) {
      var kd = parseInt(m[1], 10)
      if (kd >= 0 && kd <= 100) return kd
    }
    return null
  }

  function noDataOnPage(text) {
    // Ahrefs shows nothing / not enough data message sometimes
    return /not enough data|データ不足|no data/i.test(text)
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
    var text = getFullText()

    // If we can see "SERP & KD" heading the page has loaded
    if (text.indexOf('SERP & KD') !== -1) {
      var kd = extractKD()
      sendResult(kd) // send whatever we found (null = no data)
      return
    }

    if (noDataOnPage(text)) {
      sendResult(null)
    }
  }

  var observer = new MutationObserver(function () { tryExtract() })

  setTimeout(function () {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    tryExtract()
    setTimeout(function () {
      observer.disconnect()
      if (!sent) sendResult(null)
    }, 25000)
  }, 1500)
})()
