export type PhoneEntry = {
  phone: string
  type: string      // 電気 / ガス / 水道 / TEL / FAX / etc
  company: string   // company name
  raw: string       // the source line
}

// Covers: 03-1234-5678 / 0120-278-033 / 0570-076-021 / 04-7092-1011 / (0120-993-595)
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

function cleanCompany(text: string): string {
  return text
    .replace(/[（）【】「」：:…→←・｜]/g, " ")
    .replace(/電気|電力|ガス|水道|TEL|FAX|電話|鍵|光回線|光|hikari|管理|連絡先|番号|フリーダイヤル/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// Does a line look like a company/org name (not a phone/address/url line)?
function looksLikeCompany(line: string): boolean {
  if (PHONE_RE.test(line)) return false
  if (/^〒/.test(line)) return false
  if (/^https?:\/\//.test(line)) return false
  if (/Email|URL|営業時間|定休日/.test(line)) return false
  if (/株式会社|有限会社|合同会社|一般財団|一般社団|組合|局/.test(line)) return true
  // A short line with no separators is probably a name
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

      // Detect type from this line, or lines above
      const type = detectType(before) || detectType(line) ||
        detectType(lines.slice(Math.max(0, li - 3), li).join(" "))

      // Company: from same line first
      let company = cleanCompany(before)

      // If nothing on same line, scan up to 4 previous lines for a company-like line
      if (!company) {
        for (let back = li - 1; back >= Math.max(0, li - 4); back--) {
          if (looksLikeCompany(lines[back])) {
            company = lines[back]
            break
          }
        }
      }

      results.push({ phone, type, company, raw: line })
    }
  }

  return results
}
