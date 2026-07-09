"use server"

export type SeoRow = {
  keyword: string
  google: number | null
  yahoo: number | null
  kd: number | null
  error?: string
}

function parseHtml(html: string): { google: number | null; yahoo: number | null } {
  // Try page title first — some keyword tools encode volumes there
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    const title = titleMatch[1]
    const gTitle = title.match(/Google[^\d]*([\d,]+)/i)
    const yTitle = title.match(/Yahoo[^\d]*([\d,]+)/i)
    if (gTitle || yTitle) {
      return {
        google: gTitle ? parseInt(gTitle[1].replace(/,/g, "")) : null,
        yahoo:  yTitle ? parseInt(yTitle[1].replace(/,/g, "")) : null,
      }
    }
  }

  // Try embedded JSON-like patterns
  const jsonPatterns: Array<[RegExp, RegExp]> = [
    [/"google[_\-]?(?:volume|vol|count|monthly)"[^:]*:\s*"?([\d,]+)/i, /"yahoo[_\-]?(?:volume|vol|count|monthly)"[^:]*:\s*"?([\d,]+)/i],
    [/google_month[^"']*["']:["']?([\d,]+)/i, /yahoo_month[^"']*["']:["']?([\d,]+)/i],
  ]
  for (const [gPat, yPat] of jsonPatterns) {
    const g = html.match(gPat)
    const y = html.match(yPat)
    if (g || y) {
      return {
        google: g ? parseInt(g[1].replace(/,/g, "")) : null,
        yahoo:  y ? parseInt(y[1].replace(/,/g, "")) : null,
      }
    }
  }

  // Strip all tags and search text near Google/Yahoo markers
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")

  let google: number | null = null
  let yahoo: number | null = null

  // Split on each Google/Yahoo occurrence and grab the first number after it
  const segments = text.split(/(?=(?:Google|グーグル|Yahoo|ヤフー))/i)
  for (const seg of segments) {
    // Only look at numbers in the next ~80 chars to stay local
    const local = seg.slice(0, 80)
    const nums = local.match(/[\d]{3,}/g)?.map(n => parseInt(n.replace(/,/g, ""))).filter(n => n > 0)
    if (!nums?.length) continue
    const vol = nums[0]
    if (/Google|グーグル/i.test(local) && google === null) google = vol
    if (/Yahoo|ヤフー/i.test(local)   && yahoo  === null) yahoo  = vol
  }

  return { google, yahoo }
}

export async function lookupKeyword(keyword: string): Promise<SeoRow> {
  const kw = keyword.trim()
  if (!kw) return { keyword: kw, google: null, yahoo: null, kd: null }

  try {
    const url = `https://aramakijake.jp/keyword/?keyword=${encodeURIComponent(kw)}`
    const res = await fetch(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control":   "no-cache",
        "Pragma":          "no-cache",
        "Referer":         "https://aramakijake.jp/",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      // 8-second timeout
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return { keyword: kw, google: null, yahoo: null, kd: null, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const { google, yahoo } = parseHtml(html)

    if (google === null && yahoo === null) {
      return { keyword: kw, google: null, yahoo: null, kd: null, error: "parse_failed" }
    }

    return { keyword: kw, google, yahoo, kd: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { keyword: kw, google: null, yahoo: null, kd: null, error: msg }
  }
}
