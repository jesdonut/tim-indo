// 協力確認書 CSV → seed SQL
//
//   node scripts/importKyoryoku.mjs "<path to CSV>"
//
// Parses the 協力確認書 CSV, de-duplicates municipalities, derives status,
// and writes supabase/migrations/seed_kyoryoku.sql for pasting into the
// Supabase SQL editor. Rows that cannot be converted are REPORTED, never
// silently dropped.

import { readFileSync, writeFileSync } from "fs"

const CSV = process.argv[2] ?? "/Users/jessica/Downloads/協力確認書 整形済み - 協力確認書 整形済み.csv"
const OUT = "supabase/migrations/seed_kyoryoku.sql"

// ── CSV (quote-aware) ────────────────────────────────────────────────────────
function parseCsv(s) {
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows = []
  let row = [], f = "", q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++ } else q = false }
      else f += c
    } else {
      if (c === '"') q = true
      else if (c === ",") { row.push(f); f = "" }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = "" }
      else f += c
    }
  }
  row.push(f); rows.push(row)
  return rows
}

const sq = v => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`)
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/

// 「2025年11月28日」「2025年12月01日」→ 2025-11-28
function parseDate(raw) {
  const t = (raw ?? "").split("\n")[0].trim()
  if (!t) return null
  const m = t.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/)
  if (!m) return undefined // undefined = 変換不能（エラー行として報告）
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
}

// 提出確認方法セル（複数行あり）→ { method, email, note }
function parseMethod(raw) {
  const lines = (raw ?? "").split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { method: "未調査", email: null, note: null }

  const email = lines.map(l => l.match(EMAIL_RE)?.[0]).find(Boolean) ?? null
  const head = lines[0]
  // 括弧内の但し書き（アカウント作成必要 / エクセルファイル指定 など）は notes へ
  const note = head.match(/[(（](.+?)[)）]/)?.[1] ?? null

  let method
  if (/メール/.test(head)) method = "メール"
  else if (/ホームページ|フォーム/.test(head)) method = "ホームページフォーム"
  else if (/電子/.test(head)) method = "電子申請システム"
  else if (/郵送/.test(head)) method = "郵送"
  else if (/窓口/.test(head)) method = "窓口"
  else if (/電話/.test(head)) method = "電話"
  else if (EMAIL_RE.test(head)) method = "メール"          // 1行目がそのままメアド
  else if (/^無$/.test(head)) method = "未調査"
  else method = null                                        // 未知 → エラー報告

  return { method, email, note: note ?? (method === null ? head : null) }
}

// 住所が壊れている行の検出（【移動先】/ 統合 / 改行混在）
function addressLooksBroken(addr) {
  const a = (addr ?? "").trim()
  return a.includes("\n") || a.includes("【移動") || a.includes("→") || a.includes("➤")
}

const isRealReceipt = v => {
  const t = (v ?? "").trim()
  return !!t && !/^(無|なし|確認必要|申請中)/.test(t) && !t.includes("\n") ? t : null
}

// ── Run ──────────────────────────────────────────────────────────────────────
const grid = parseCsv(readFileSync(CSV, "utf8"))
const H = grid[0]
const I = n => H.indexOf(n)
const C = {
  code: I("店舗CD"), name: I("店舗名"), zip: I("郵便番号"), addr: I("店舗の住所"),
  muni: I("申請した市役所、区役所"), date: I("申請日・確認日"), method: I("提出確認方法"),
  receipt: I("受付番号"), link: I("市役所のリンク"), notes: I("注意点"),
}

const rows = grid.slice(1).filter(r => r.some(x => (x ?? "").trim()))
const errors = []
const munis = new Map()   // name → {name, method, email, form_url, notes}
const subs = []

rows.forEach((r, i) => {
  const line = i + 2 // 1-indexed incl. header
  const get = k => (r[C[k]] ?? "").trim()

  const muniName = get("muni")
  const storeName = get("name")
  const addr = get("addr")

  const { method, email, note } = parseMethod(r[C.method])
  const date = parseDate(r[C.date])

  // ── 変換不能 → エラー報告（捨てない） ──
  if (date === undefined) {
    errors.push({ line, store: storeName, reason: `日付が変換できません: "${get("date").split("\n")[0]}"` })
  }
  if (method === null) {
    errors.push({ line, store: storeName, reason: `提出方法が判定できません: "${get("method").split("\n")[0]}"` })
  }
  if (addressLooksBroken(addr)) {
    errors.push({ line, store: storeName, reason: `住所に移動先/複数店舗が混在: ${JSON.stringify(addr).slice(0, 80)}…` })
  }

  // ── 自治体（重複排除・最初の非空値を採用） ──
  if (muniName) {
    const cur = munis.get(muniName) ?? { name: muniName, method: "未調査", email: null, form_url: null, notes: null }
    if (cur.method === "未調査" && method && method !== "未調査") cur.method = method
    cur.email ??= email
    cur.form_url ??= (get("link").split("\n")[0] || null)
    cur.notes ??= ([note, get("notes")].filter(Boolean).join(" / ") || null)
    munis.set(muniName, cur)
  }

  // ── ステータス ──
  const receipt = isRealReceipt(get("receipt"))
  let status
  if (!muniName) status = "未着手"
  else if (receipt) status = "受理確認済"
  else if (date) status = "提出済"
  else status = "調査済"

  subs.push({
    store_code: get("code") || null,
    store_name: storeName || null,
    store_address: addressLooksBroken(addr) ? addr.split("\n")[0] : (addr || null),
    muni: muniName || null,
    status,
    submitted_at: date || null,
    receipt_number: receipt,
  })
})

// ── SQL ──────────────────────────────────────────────────────────────────────
const muniList = [...munis.values()]
let sql = `-- 協力確認書 初期データ (generated by scripts/importKyoryoku.mjs)
-- ${muniList.length} municipalities / ${subs.length} submissions
begin;

insert into public.municipalities (name, submission_method, email, form_url, notes) values
${muniList.map(m => `  (${sq(m.name)}, ${sq(m.method)}, ${sq(m.email)}, ${sq(m.form_url)}, ${sq(m.notes)})`).join(",\n")}
on conflict (name) do nothing;

insert into public.kyoryoku_submissions
  (store_code, store_name, store_address, municipality_id, status, submitted_at, receipt_number) values
${subs.map(s => `  (${sq(s.store_code)}, ${sq(s.store_name)}, ${sq(s.store_address)}, ${
  s.muni ? `(select id from public.municipalities where name = ${sq(s.muni)})` : "null"
}, ${sq(s.status)}, ${sq(s.submitted_at)}, ${sq(s.receipt_number)})`).join(",\n")};

commit;
`
writeFileSync(OUT, sql)

// ── Report ───────────────────────────────────────────────────────────────────
const byStatus = subs.reduce((a, s) => ((a[s.status] = (a[s.status] ?? 0) + 1), a), {})
const byMethod = muniList.reduce((a, m) => ((a[m.method] = (a[m.method] ?? 0) + 1), a), {})

console.log("=== 取り込み結果 ===")
console.log(`CSVデータ行:      ${rows.length}`)
console.log(`提出記録:         ${subs.length}`)
console.log(`自治体(重複排除): ${muniList.length}`)
console.log(`  うちメール有り: ${muniList.filter(m => m.email).length}`)
console.log("\nステータス内訳:")
Object.entries(byStatus).forEach(([k, v]) => console.log(`  ${k.padEnd(6)} ${v}`))
console.log("\n自治体の提出方法内訳:")
Object.entries(byMethod).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}`))

console.log(`\n=== 要確認 (${errors.length}件) — 捨てずに取り込み済み、後で手修正してください ===`)
errors.forEach(e => console.log(`  CSV行${e.line} [${e.store}] ${e.reason}`))
console.log(`\n→ ${OUT} を生成しました`)
