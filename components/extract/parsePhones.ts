export type PhoneEntry = {
  phone: string
  type: string      // 電気 / ガス / 水道 / TEL / FAX / etc
  company: string
  raw: string
}

// Covers: 03-1234-5678 / 0120-278-033 / 0570-076-021 / 04-7092-1011
const PHONE_RE = /0\d{1,4}[- ]?\d{2,4}[- ]?\d{2,4}/g

const TYPE_MAP: [RegExp, string][] = [
  [/電気|電力/,       "電気"],
  [/ガス/,           "ガス"],
  [/水道/,           "水道"],
  [/FAX|ファックス/i, "FAX"],
  [/TEL|電話/,       "TEL"],
  [/鍵|キー/,        "鍵"],
  [/光|hikari/i,    "光回線"],
  [/管理/,           "管理"],
]

function detectType(text: string): string {
  for (const [re, label] of TYPE_MAP) {
    if (re.test(text)) return label
  }
  return ""
}

function stripTypeMarker(text: string): string {
  // Remove leading （電気）/（ガス）/（水道）/（鍵受取り） etc.
  return text.replace(/^[（(][^）)]*[）)]\s*/, "").trim()
}

function cleanCompany(text: string): string {
  // First strip leading type marker like （電気）
  let t = stripTypeMarker(text)
  t = t
    .replace(/[（）【】「」：:…→←・｜]/g, " ")
    // Only remove TEL/FAX as standalone words, not embedded in company names
    .replace(/\bTEL\b|\bFAX\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  return t
}

// Strong company indicator (definitely a company line)
function isExplicitCompany(line: string): boolean {
  return /株式会社|有限会社|合同会社|一般財団|一般社団|組合|局/.test(line)
}

// Does a line look like it might be a company/org name?
function looksLikeCompany(line: string): boolean {
  PHONE_RE.lastIndex = 0
  if (PHONE_RE.test(line)) return false
  if (/^〒/.test(line)) return false
  if (/^https?:\/\//.test(line)) return false
  if (/Email|URL|営業時間|定休日/.test(line)) return false
  if (isExplicitCompany(line)) return true
  // Short line with no separators could be a name/company
  return line.length <= 20 && !/[：:…→←]/.test(line)
}

export function parsePhones(text: string): PhoneEntry[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const results: PhoneEntry[] = []
  const seen = new Set<string>()

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    PHONE_RE.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = PHONE_RE.exec(line)) !== null) {
      const phone = match[0].replace(/\s/g, "-")
      const digits = phone.replace(/\D/g, "")
      if (digits.length < 9 || seen.has(digits)) continue
      seen.add(digits)

      const before = line.slice(0, match.index)

      // Detect type: check current line, then scan up to 5 lines back
      const type =
        detectType(before) ||
        detectType(line) ||
        detectType(lines.slice(Math.max(0, li - 5), li).join(" "))

      // Company: strip type marker from same line first
      let company = cleanCompany(before)

      // If nothing useful on same line, scan up to 5 previous lines
      // Prefer lines with explicit company markers (株式会社 etc.) over length heuristic
      if (!company) {
        let fallback = ""
        for (let back = li - 1; back >= Math.max(0, li - 5); back--) {
          const prev = lines[back]
          if (looksLikeCompany(prev)) {
            if (isExplicitCompany(prev)) {
              company = prev
              break
            }
            if (!fallback) fallback = prev
          }
        }
        if (!company) company = fallback
      }

      results.push({ phone, type, company, raw: line })
    }
  }

  return results
}
