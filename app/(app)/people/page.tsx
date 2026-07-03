"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { PageHeader, PillTabs, ToolContent } from "@/components/PageHeader"
import { getWorkers, getWorkersDebug, upsertWorkers, updateWorker, deleteWorker, exportWorkersCsv, syncWorkerStoreInfo, type Worker } from "@/app/actions/workers"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { createClient } from "@/lib/supabase/client"
import StoresTab from "@/components/people/StoresTab"

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

// Normalize any date string to YYYY-MM-DD. Missing year defaults to current year.
function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null
  s = s.trim().replace(/[\s　]+/g, "")
  if (!s) return null

  // Already ISO: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Slash: 2026/1/15 or 26/1/15
  const slash = s.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slash) {
    let y = parseInt(slash[1]); if (y < 100) y += 2000
    return `${y}-${slash[2].padStart(2,"0")}-${slash[3].padStart(2,"0")}`
  }

  // Full Japanese: 2026年1月15日
  const jpFull = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (jpFull) return `${jpFull[1]}-${jpFull[2].padStart(2,"0")}-${jpFull[3].padStart(2,"0")}`

  // Japanese no year: 1月29日 — assume current year
  const jpNoYear = s.match(/^(\d{1,2})月(\d{1,2})日$/)
  if (jpNoYear) {
    const y = new Date().getFullYear()
    return `${y}-${jpNoYear[1].padStart(2,"0")}-${jpNoYear[2].padStart(2,"0")}`
  }

  // Reiwa era: R8.1.15 or R8/1/15
  const reiwa = s.match(/^[Rr](\d+)[./](\d{1,2})[./](\d{1,2})$/)
  if (reiwa) {
    const y = 2018 + parseInt(reiwa[1])
    return `${y}-${reiwa[2].padStart(2,"0")}-${reiwa[3].padStart(2,"0")}`
  }

  // Dot: 2026.1.15
  const dot = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
  if (dot) return `${dot[1]}-${dot[2].padStart(2,"0")}-${dot[3].padStart(2,"0")}`

  return s // return as-is if unrecognized
}

function normalizeGender(s: string | null | undefined): string | null {
  if (!s) return null
  const v = s.trim()
  if (v === "男" || v === "male" || v.toLowerCase() === "m") return "男性"
  if (v === "女" || v === "female" || v.toLowerCase() === "f") return "女性"
  return v
}

type GasInfo = { date: string | null; time: string | null; hasDeposit: boolean; depositAmount: string | null }

function parseGasAppointment(s: string | null | undefined): GasInfo {
  const empty: GasInfo = { date: null, time: null, hasDeposit: false, depositAmount: null }
  if (!s) return empty

  // Normalize full-width digits → half-width
  const norm = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

  // Date: 1月16日 optionally with day-of-week (木)
  const dateMatch = norm.match(/(\d{1,2}月\d{1,2}日(?:[（(][月火水木金土日][)）])?)/)
  const date = dateMatch ? dateMatch[1] : null

  // Time: "15-17時", "15時〜17時", "15:00〜17:00"
  const timeMatch =
    norm.match(/(\d{1,2})[:\-](\d{1,2})時/) ||
    norm.match(/(\d{1,2})時[〜~ー\-](\d{1,2})時/) ||
    norm.match(/(\d{1,2}):(\d{2})[〜~ー\-](\d{1,2}):\d{2}/)
  const time = timeMatch
    ? timeMatch[3] ? `${timeMatch[1]}:${timeMatch[2]}〜${timeMatch[3]}時` : `${timeMatch[1]}〜${timeMatch[2]}時`
    : null

  // Deposit
  const hasDeposit = norm.includes("保証金あり") || (norm.includes("保証金") && !norm.includes("保証金なし"))
  let depositAmount: string | null = null
  if (hasDeposit) {
    const manMatch = norm.match(/(\d+(?:\.\d+)?)万円/)
    const yenMatch = norm.match(/(\d[\d,]*)円/)
    if (manMatch) {
      depositAmount = `¥${Math.round(parseFloat(manMatch[1]) * 10000).toLocaleString()}`
    } else if (yenMatch) {
      depositAmount = `¥${yenMatch[1]}`
    }
  }

  return { date, time, hasDeposit, depositAmount }
}

function normPayrollUsername(s: string | null | undefined): string | null {
  if (!s) return null
  const v = s.trim()
  if (!v) return null
  return /^\d+$/.test(v) ? v.padStart(9, "0") : v
}

const DATE_FIELDS = new Set<WKey>([
  "birth_date","first_work_date","move_in_date","japan_arrival_date",
  "departure_date","electricity_date","water_date","linkus_updated_at",
])

function parseCsvText(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = [], field = "", inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field === "#N/A" ? "" : field); field = "" }
      else if (c === '\n') { row.push(field === "#N/A" ? "" : field); rows.push(row); row = []; field = "" }
      else if (c !== '\r') field += c
    }
  }
  if (row.length || field) { row.push(field); rows.push(row) }
  return rows
}

type WKey = keyof Omit<Worker, "id" | "team_id" | "created_at" | "updated_at">

const SIMPLE_MAP: Array<[string, WKey]> = [
  ["配属者名",     "name_kana"],
  ["ニックネーム",  "nickname"],
  ["従業員番号",   "employee_no"],
  ["性別",         "gender"],
  ["国籍",         "nationality"],
  ["生年月日",     "birth_date"],
  ["携帯電話",     "mobile_phone"],
  ["メールアドレス","email"],
  ["店舗CD",       "store_code"],
  ["店舗名称",     "store_name"],
  ["店舗電話",     "store_phone"],
  ["業態名称",     "business_unit"],
  ["営業部名称",   "division_name"],
  ["配属月",       "assignment_month"],
  ["物件名",       "housing_building"],
  ["部屋番号",     "housing_room"],
  ["パスコード",   "housing_passcode"],
  ["家賃",         "rent"],
  ["入国グループ", "arrival_group"],
  ["便名",         "flight_number"],
  ["到着時間",     "arrival_time"],
  ["電気",         "electricity_date"],
  ["水道",         "water_date"],
  ["ガス立会",     "gas_appointment"],
  ["ガス保証金",   "gas_deposit"],
  ["通勤距離",     "commute_distance"],
  ["サポート担当", "support_staff"],
  ["入社日",       "first_work_date"],
  ["入居日",       "move_in_date"],
  ["出国日",       "departure_date"],
  ["入居ガイド",   "leopalace_url"],
  ["ライフライン連絡先", "leopalace_url"],
  ["通勤ルート",   "commute_route_url"],
]

function buildColMap(headers: string[]): Array<{ field: WKey; idx: number }> {
  const result: Array<{ field: WKey; idx: number }> = []
  const used = new Set<WKey>()
  let postalN = 0, payrollN = 0

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].replace(/[\s　\n\r]/g, "")
    if (!h) continue

    let field: WKey | null = null

    if (h === "N0." || h === "No." || h === "通し番号" || h === "遠し番号") {
      field = "worker_id"
    } else if (h.includes("ペイロール") && h.includes("PASS")) {
      field = "payroll_password"
    } else if (h.includes("郵便番号")) {
      field = postalN++ === 0 ? "store_postal_code" : "housing_postal_code"
    } else if (h.includes("社宅住所")) {
      field = "housing_address"
    } else if (h.includes("住所") && !h.includes("社宅") && !used.has("store_address")) {
      field = "store_address"
    } else if (h.includes("日本") && h.includes("入国日")) {
      field = "japan_arrival_date"
    } else if (h.includes("ペイロール")) {
      field = payrollN++ === 0 ? "payroll_pre_id" : "payroll_post_id"
    } else if (h.includes("入国空港") && !used.has("arrival_airport")) {
      field = "arrival_airport"
    } else {
      for (const [pat, f] of SIMPLE_MAP) {
        if (h.includes(pat) && !used.has(f)) { field = f; break }
      }
    }

    if (field && !used.has(field)) {
      result.push({ field, idx: i })
      used.add(field)
    }
  }
  return result
}

// English column headers from our own export — maps directly 1:1 to Worker fields
const ENGLISH_FIELDS = new Set<string>([
  "worker_id","employee_no","name_kana","nickname","name_latin","gender","nationality",
  "birth_date","mobile_phone","whatsapp","email","assignment_month","batch_period",
  "first_work_date","move_in_date","business_unit","division_name","support_staff",
  "store_code","store_name","store_postal_code","store_address","store_phone",
  "housing_postal_code","housing_address","housing_building","housing_room",
  "housing_passcode","rent","commute_distance","commute_route_url","departure_date",
  "japan_arrival_date","arrival_airport","flight_number","arrival_time","arrival_group",
  "electricity_date","water_date","gas_appointment","gas_deposit",
  "payroll_pre_id","payroll_post_id","payroll_password","leopalace_url",
  "status","signal_status","mynumber_status",
  "pledge_done","linkus_updated_at","area","notes",
])

// ─── Indonesia team file parsers ──────────────────────────────────────────────

// 管理シート: 番号, 氏名, 名前, LINKUS更新, 誓約書, マイナンバー, WA番号, ガス, 電気, 水道, セコム, ＰＤＦ, 初出勤, ...担当者, 入国日...
const MGMT_COLS: Array<[number, WKey] | [number, null]> = [
  [0,  "worker_id"],
  [1,  "name_kana"],
  [2,  "name_latin"],
  [3,  "linkus_updated_at"],
  // 4 = 誓約書 (handled separately)
  [5,  "mynumber_status"],
  [6,  "whatsapp"],
  [7,  "gas_appointment"],
  [8,  "electricity_date"],
  [9,  "water_date"],
  [12, "first_work_date"],
  [14, "payroll_pre_id"],
  [15, "payroll_post_id"],
  [16, "payroll_password"],
  [17, "support_staff"],
  [18, "japan_arrival_date"],
  [32, "notes"],
]

function parseMgmtSheet(rows: string[][]): Partial<Worker>[] {
  const out: Partial<Worker>[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const num = row[0]?.trim()
    const nameKana = row[1]?.trim()
    if (!nameKana || !num || num === "番号") continue
    const w: Record<string, string | number | boolean | null> = {}
    for (const [idx, field] of MGMT_COLS) {
      if (field === null) continue
      const val = (row[idx] ?? "").trim()
      if (!val) continue
      if (field === "payroll_post_id") w[field] = normPayrollUsername(val) ?? val
      else w[field] = field === "gender" ? (normalizeGender(val) ?? val) : DATE_FIELDS.has(field) ? normalizeDate(val) ?? val : val
    }
    // pledge_done: ✔ or similar = true
    const pledge = (row[4] ?? "").trim()
    w.pledge_done = pledge === "✔" || pledge === "✓" || pledge === "済み" || pledge.includes("済")
    out.push(w as Partial<Worker>)
  }
  return out
}

// データベース: 2-row header (rows 0+1 combined), data rows start with I2/I3/etc.
// col: 0=worker_id, 1=name_kana, 2=name_latin, 3=フォーム(skip), 4=status, 5=birth_date
//      6=move_in_date, 7=first_work_date, 8=support_staff, 9=area
//      10=store_code, 11=store_name, 12=store_postal_code, 13=store_address
//      14=store_phone, 15=employee_no, 16=housing_postal_code, 17=housing_address
//      18=housing_building, 19=housing_room, 20=mobile_phone
//      21=signal_status, 23=commute_distance, 24=commute_route_url, 27=notes
const DB_COLS: Array<[number, WKey]> = [
  [0,  "worker_id"],
  [1,  "name_kana"],
  [2,  "name_latin"],
  [4,  "status"],
  [5,  "birth_date"],
  [6,  "move_in_date"],
  [7,  "first_work_date"],
  [8,  "support_staff"],
  [9,  "area"],
  [10, "store_code"],
  [11, "store_name"],
  [12, "store_postal_code"],
  [13, "store_address"],
  [14, "store_phone"],
  [15, "payroll_post_id"],
  [16, "housing_postal_code"],
  [17, "housing_address"],
  [18, "housing_building"],
  [19, "housing_room"],
  [20, "mobile_phone"],
  [21, "signal_status"],
  [23, "commute_distance"],
  [24, "commute_route_url"],
  [26, "leopalace_url"],
  [27, "notes"],
]

function parseDatabase(rows: string[][]): Partial<Worker>[] {
  const out: Partial<Worker>[] = []
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]
    const id = row[0]?.trim()
    // skip batch headers ("1月", "通し番号" etc.) — must contain an uppercase letter to be a worker ID
    if (!id || !/[A-Z]/.test(id)) continue
    const w: Record<string, string | number | boolean | null> = {}
    for (const [idx, field] of DB_COLS) {
      const val = (row[idx] ?? "").trim()
      if (!val) continue
      w[field] = field === "gender" ? (normalizeGender(val) ?? val) : DATE_FIELDS.has(field) ? normalizeDate(val) ?? val : val
    }
    if (w.name_kana) out.push(w as Partial<Worker>)
  }
  return out
}

// ─── Main CSV entry point ─────────────────────────────────────────────────────

function normalizePayrollFields(workers: Partial<Worker>[]): Partial<Worker>[] {
  for (const w of workers) {
    // post-id: pad pure-digit values to 9 chars
    if (w.payroll_post_id) w.payroll_post_id = normPayrollUsername(w.payroll_post_id) ?? w.payroll_post_id
    // pre-id and username are ZTEN-style (contain letters) — sync them with each other only
    const hasLetters = (v: string | null | undefined) => !!v && /[A-Za-z]/.test(v)
  }
  return workers
}

type ParseResult = { workers: Partial<Worker>[]; isExport: boolean; fileType: string }

function parseWorkersFromCsv(text: string): ParseResult {
  const rows = parseCsvText(text)
  if (rows.length === 0) return { workers: [], isExport: false, fileType: "unknown" }

  const firstRow = rows[0]

  // Our own export — English headers
  if (firstRow.filter(h => ENGLISH_FIELDS.has(h)).length > 5) {
    const headers = firstRow
    const out: Partial<Worker>[] = []
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      if (!row.some(c => c.trim())) continue
      const w: Record<string, string | number | boolean | null> = {}
      headers.forEach((h, i) => {
        if (!ENGLISH_FIELDS.has(h)) return
        const val = (row[i] ?? "").trim()
        if (!val) return
        if (h === "rent") { const n = parseInt(val); if (!isNaN(n)) w.rent = n }
        else if (h === "pledge_done") w.pledge_done = val === "true"
        else w[h] = val
      })
      if (w.name_kana) out.push(w as Partial<Worker>)
    }
    return { workers: normalizePayrollFields(out), isExport: true, fileType: "export" }
  }

  // 管理シート (management tracking sheet)
  if (firstRow[0] === "番号" && firstRow.some(h => h.includes("LINKUS") || h.includes("誓約書"))) {
    return { workers: normalizePayrollFields(parseMgmtSheet(rows)), isExport: false, fileType: "management" }
  }

  // データベース (team database)
  if (firstRow[0] === "遠し番号" || (firstRow[1] === "ふりがな" && firstRow[4] === "ステータス")) {
    return { workers: normalizePayrollFields(parseDatabase(rows)), isExport: false, fileType: "database" }
  }

  // Company CSV (grasp-data-main, Japanese headers with 配属者名)
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (rows[i].some(c => c.includes("配属者名"))) { headerIdx = i; break }
  }
  if (headerIdx === -1) return { workers: [], isExport: false, fileType: "unknown" }

  const colMap = buildColMap(rows[headerIdx])
  const nameEntry = colMap.find(m => m.field === "name_kana")
  if (!nameEntry) return { workers: [], isExport: false, fileType: "unknown" }

  const meta0 = rows[0]
  const batchMonthIdx = meta0.indexOf("batch_month")
  const batchPeriodIdx = meta0.indexOf("batch_period")

  const out: Partial<Worker>[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row[nameEntry.idx]?.trim()) continue
    const w: Record<string, string | number | boolean | null> = {}
    for (const { field, idx } of colMap) {
      const val = (row[idx] ?? "").trim()
      if (!val) continue
      if (field === "rent") {
        const n = parseInt(val.replace(/[^0-9]/g, ""))
        if (!isNaN(n)) w.rent = n
      } else {
        w[field] = field === "gender" ? (normalizeGender(val) ?? val) : DATE_FIELDS.has(field) ? normalizeDate(val) ?? val : val
      }
    }
    if (batchMonthIdx >= 0 && row[batchMonthIdx]?.trim())
      w.assignment_month = row[batchMonthIdx].trim()
    if (batchPeriodIdx >= 0 && row[batchPeriodIdx]?.trim())
      w.batch_period = row[batchPeriodIdx].trim()
    out.push(w as Partial<Worker>)
  }
  return { workers: normalizePayrollFields(out), isExport: false, fileType: "company" }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_OPTS = ["順調", "注意", "要確認", "対応必要", "問題あり", "連絡待ち", "終了"]
const STATUS_COLOR: Record<string, string> = {
  "順調":    "bg-emerald-500/15 text-emerald-400",
  "注意":    "bg-amber-500/15 text-amber-400",
  "要確認":  "bg-amber-500/15 text-amber-400",
  "対応必要":"bg-red-500/15 text-red-400",
  "問題あり":"bg-red-500/15 text-red-400",
  "連絡待ち":"bg-blue-500/15 text-blue-400",
  "終了":    "bg-[var(--bg-2)] text-[var(--text-3)]",
}

function PasswordCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className="flex items-center gap-1.5 group">
      <span
        className={cn(
          "font-mono text-[0.72rem] select-all cursor-text",
          revealed ? "text-[var(--text)]" : "blur-[3px] text-[var(--text-2)] select-all"
        )}
        onClick={() => setRevealed(r => !r)}
        title={revealed ? "Click to hide" : "Click to reveal"}
      >
        {value}
      </span>
    </span>
  )
}

function StatusChip({ status }: { status?: string | null }) {
  const s = status ?? "順調"
  return (
    <span className={cn("px-2 py-0.5 rounded text-[0.65rem] font-medium", STATUS_COLOR[s] ?? "bg-[var(--bg-2)] text-[var(--text-3)]")}>
      {s}
    </span>
  )
}

function Dot({ ok, title: _title }: { ok?: boolean | null; title?: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full", ok ? "bg-emerald-400" : "bg-[var(--border)]")} />
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

type EditState = Partial<Worker>

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-xs">{label}</span>
      {children}
    </div>
  )
}

function TF({
  value, onChange, textarea, type,
}: {
  value?: string | null
  onChange: (v: string) => void
  textarea?: boolean
  type?: string
}) {
  const cls = "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors resize-none"
  // Only stop arrow keys from reaching the table — let Enter bubble up to WorkerPanel
  const stopKeys = (e: React.KeyboardEvent) => { if (["ArrowUp","ArrowDown"].includes(e.key)) e.stopPropagation() }
  if (textarea) return <textarea className={cn(cls, "min-h-[60px]")} value={value ?? ""} onChange={e => onChange(e.target.value)} onKeyDown={stopKeys} />
  return <input className={cls} type={type ?? "text"} value={value ?? ""} onChange={e => onChange(e.target.value)} onKeyDown={stopKeys} />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-xs mb-2 border-b border-[var(--border)] pb-1">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

// ─── Inline cell editor ───────────────────────────────────────────────────────

function EditableCell({
  worker, col, onSaved, onEscape, onNavigate,
}: {
  worker: Worker
  col: ColDef
  onSaved: (updated: Worker) => void
  onEscape: () => void
  onNavigate?: (dir: "next" | "prev" | "down") => void
}) {
  const isDate = DATE_FIELDS.has(col.key as WKey)
  const [val, setVal] = useState(worker[col.key] != null ? String(worker[col.key]) : "")
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null)

  useEffect(() => {
    ref.current?.focus()
    try { (ref.current as HTMLInputElement)?.select() } catch { /* ignore */ }
  }, [])

  async function commit(v: string) {
    const clean: string | null = isDate ? (normalizeDate(v) ?? (v || null)) : (v || null)
    const updated = { ...worker, [col.key]: clean }
    onSaved(updated as Worker)  // optimistic — update UI immediately
    updateWorker(worker.id, { [col.key]: clean })  // fire-and-forget
  }

  const cls = "absolute inset-0 w-full h-full bg-[var(--bg)] border border-[var(--highlight)] outline-none text-[0.78rem] text-[var(--text)] px-2 z-50"

  function handleNavKey(e: React.KeyboardEvent, currentVal: string) {
    if (e.key === "Tab") {
      e.preventDefault()
      commit(currentVal).then(() => onNavigate?.(e.shiftKey ? "prev" : "next"))
    } else if (e.key === "Enter") {
      e.preventDefault()
      commit(currentVal).then(() => onNavigate?.("down"))
    } else if (e.key === "Escape") {
      e.preventDefault()
      onEscape()
    }
    e.stopPropagation()
  }

  if (col.key === "status") {
    return (
      <select
        ref={ref}
        value={val}
        onChange={e => { setVal(e.target.value); commit(e.target.value) }}
        onBlur={onEscape}
        onKeyDown={e => handleNavKey(e, val)}
        className={cls}
      >
        {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )
  }

  if (col.key === "gender") {
    return (
      <select
        ref={ref}
        value={val}
        onChange={e => { setVal(e.target.value); commit(e.target.value) }}
        onBlur={onEscape}
        onKeyDown={e => handleNavKey(e, val)}
        className={cls}
      >
        <option value="">—</option>
        <option value="男性">男性</option>
        <option value="女性">女性</option>
      </select>
    )
  }

  return (
    <input
      ref={ref}
      type={isDate ? "date" : "text"}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => commit(val)}
      onKeyDown={e => handleNavKey(e, val)}
      className={cls}
    />
  )
}

function WorkerPanel({
  worker,
  onClose,
  onSaved,
  onDeleted,
}: {
  worker?: Worker        // undefined = new worker
  onClose: () => void
  onSaved: (w: Worker) => void
  onDeleted: (id: string) => void
}) {
  const isNew = !worker
  const [edit, setEdit] = useState<EditState>(worker ? { ...worker } : { status: "順調" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPayroll, setShowPayroll] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tenpoLoading, setTenpoLoading] = useState(false)
  const [tenpoMsg, setTenpoMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null)
  const supabase = useRef(createClient()).current

  function set(field: keyof EditState, val: string | boolean | null) {
    setEdit(prev => ({ ...prev, [field]: val }))
  }

  // Look up a store by 店舗コード (tenpo_cd) in tenpo_master and auto-fill store fields.
  async function lookupTenpo() {
    const code = (edit.store_code ?? "").trim()
    if (!code) { setTenpoMsg({ type: "error", text: "店舗コードを入力してください。" }); return }
    setTenpoLoading(true); setTenpoMsg(null)
    const { data, error } = await supabase
      .from("tenpo_master")
      .select("tenpo_name, zip, prefecture, address, tel")
      .eq("tenpo_cd", code)
      .maybeSingle()
    setTenpoLoading(false)
    if (error) { setTenpoMsg({ type: "error", text: `検索に失敗しました：${error.message}` }); return }
    if (!data) { setTenpoMsg({ type: "error", text: `店舗コード「${code}」が見つかりません。` }); return }
    setEdit(prev => ({
      ...prev,
      store_name:        data.tenpo_name ?? prev.store_name,
      store_postal_code: data.zip ?? prev.store_postal_code,
      area:              data.prefecture ?? prev.area,
      store_address:     data.address ?? prev.store_address,
      store_phone:       data.tel ?? prev.store_phone,
    }))
    setTenpoMsg({ type: "ok", text: `${data.tenpo_name ?? code} を反映しました。` })
  }

  async function save() {
    if (!edit.name_kana?.trim()) { setErr("Name (katakana) is required."); return }
    const finalEdit = edit
    setSaving(true); setErr(null)
    if (isNew) {
      const res = await upsertWorkers([finalEdit as Omit<Worker, "id" | "created_at" | "updated_at" | "team_id">], { preserveTracking: false })
      setSaving(false)
      if ("error" in res) { setErr(res.error); return }
      const all = await getWorkers()
      const created = all.find(w => w.name_kana === finalEdit.name_kana)
      if (created) onSaved(created)
    } else {
      const res = await updateWorker(worker.id, finalEdit)
      setSaving(false)
      if ("error" in res) { setErr(res.error); return }
      onSaved({ ...worker, ...finalEdit })
    }
  }

  async function doDelete() {
    if (!worker) return
    setDeleting(true)
    await deleteWorker(worker.id)
    onDeleted(worker.id)
  }

  return (
    <div
      className="flex flex-col h-full"
      onKeyDown={e => {
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
          e.preventDefault()
          save()
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
        <div>
          <p className="text-base font-semibold text-[var(--text)]">{isNew ? "New worker" : (edit.name_kana ?? "—")}</p>
          <p className="text-[0.72rem] text-[var(--text-3)]">{edit.nickname ? `${edit.nickname} · ` : ""}{edit.worker_id ?? edit.employee_no ?? ""}</p>
        </div>
        <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors mt-0.5">
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

        <Section title="Status">
          <Field label="Status">
            <select
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none"
              value={edit.status ?? "順調"}
              onChange={e => set("status", e.target.value)}
            >
              {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Signal (Kondisi Sinyal)">
            <TF value={edit.signal_status} onChange={v => set("signal_status", v)} />
          </Field>
          <Field label="My Number">
            <TF value={edit.mynumber_status} onChange={v => set("mynumber_status", v)} />
          </Field>
          <Field label="LINKUS updated">
            <TF type="date" value={edit.linkus_updated_at ?? ""} onChange={v => set("linkus_updated_at", v || null)} />
          </Field>
          <div className="col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-[0.8rem] text-[var(--text)]">
              <input type="checkbox" checked={!!edit.pledge_done} onChange={e => set("pledge_done", e.target.checked)} className="accent-[var(--text)]" />
              Pledge done (誓約書)
            </label>
          </div>
          <div className="col-span-2">
            <Field label="Notes">
              <TF value={edit.notes} onChange={v => set("notes", v)} textarea />
            </Field>
          </div>
        </Section>

        <Section title="Identity">
          <Field label="Name (katakana)"><TF value={edit.name_kana} onChange={v => set("name_kana", v)} /></Field>
          <Field label="Name (latin)"><TF value={edit.name_latin} onChange={v => set("name_latin", v)} /></Field>
          <Field label="Nickname"><TF value={edit.nickname} onChange={v => set("nickname", v)} /></Field>
          <Field label="Worker ID"><TF value={edit.worker_id} onChange={v => set("worker_id", v)} /></Field>
          <Field label="Birth date"><TF type="date" value={edit.birth_date ?? ""} onChange={v => set("birth_date", v || null)} /></Field>
          <Field label="Gender">
            <select
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none"
              value={edit.gender ?? ""}
              onChange={e => set("gender", e.target.value || null)}
            >
              <option value="">—</option>
              <option value="男性">男性</option>
              <option value="女性">女性</option>
            </select>
          </Field>
        </Section>

        <Section title="Contact">
          <Field label="Mobile phone"><TF value={edit.mobile_phone} onChange={v => set("mobile_phone", v)} /></Field>
          <Field label="WhatsApp"><TF value={edit.whatsapp} onChange={v => set("whatsapp", v)} /></Field>
          <div className="col-span-2">
            <Field label="Email"><TF value={edit.email} onChange={v => set("email", v)} /></Field>
          </div>
        </Section>

        <Section title="Work">
          <Field label="Support staff"><TF value={edit.support_staff} onChange={v => set("support_staff", v)} /></Field>
          <Field label="Area (prefecture)"><TF value={edit.area} onChange={v => set("area", v)} /></Field>
          <Field label="First work date"><TF value={edit.first_work_date} onChange={v => set("first_work_date", v)} /></Field>
          <Field label="Assignment month"><TF value={edit.assignment_month} onChange={v => set("assignment_month", v)} /></Field>
          <div className="col-span-2">
            <Field label="Store code (店舗コード)">
              <div className="flex gap-2">
                <input
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"
                  type="text"
                  value={edit.store_code ?? ""}
                  onChange={e => { set("store_code", e.target.value); setTenpoMsg(null) }}
                  onKeyDown={e => {
                    if (["ArrowUp", "ArrowDown"].includes(e.key)) e.stopPropagation()
                    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); lookupTenpo() }
                  }}
                  placeholder="コードを入力 → Enter で検索"
                />
                <button
                  type="button"
                  onClick={lookupTenpo}
                  disabled={tenpoLoading}
                  className="px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] shrink-0 transition-colors disabled:opacity-50"
                >
                  {tenpoLoading ? "検索中…" : "検索"}
                </button>
              </div>
              {tenpoMsg && (
                <p className={cn("text-[0.72rem] mt-1", tenpoMsg.type === "error" ? "text-red-400" : "text-[var(--text-2)]")}>
                  {tenpoMsg.text}
                </p>
              )}
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Store name"><TF value={edit.store_name} onChange={v => set("store_name", v)} /></Field>
          </div>
          <Field label="Store postal code"><TF value={edit.store_postal_code} onChange={v => set("store_postal_code", v)} /></Field>
          <Field label="Store phone"><TF value={edit.store_phone} onChange={v => set("store_phone", v)} /></Field>
          <div className="col-span-2">
            <Field label="Store address"><TF value={edit.store_address} onChange={v => set("store_address", v)} /></Field>
          </div>
          <Field label="Commute method"><TF value={edit.commute_method} onChange={v => set("commute_method", v)} /></Field>
          <Field label="Commute distance"><TF value={edit.commute_distance} onChange={v => set("commute_distance", v)} /></Field>
          <div className="col-span-2">
            <Field label="Commute route URL"><TF value={edit.commute_route_url} onChange={v => set("commute_route_url", v)} /></Field>
          </div>
          <div className="col-span-2">
            <Field label="Leopalace URL">
              <div className="flex gap-2">
                <TF value={edit.leopalace_url} onChange={v => set("leopalace_url", v)} />
                {edit.leopalace_url && (
                  <a href={edit.leopalace_url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] shrink-0 transition-colors">
                    Open
                  </a>
                )}
              </div>
            </Field>
          </div>
          {(edit.housing_address || edit.store_address) && (
            <div className="col-span-2 flex gap-2">
              {edit.housing_address && edit.store_address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(edit.housing_address)}&destination=${encodeURIComponent(edit.store_address)}&travelmode=transit`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-3)] transition-colors"
                >
                  Google Maps
                </a>
              )}
              {edit.housing_address && edit.store_address && (
                <a
                  href={`https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(edit.housing_address)}&to=${encodeURIComponent(edit.store_address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-3)] transition-colors"
                >
                  Yahoo Transit
                </a>
              )}
            </div>
          )}
        </Section>

        <Section title="Housing">
          <div className="col-span-2">
            <Field label="Address"><TF value={edit.housing_address} onChange={v => set("housing_address", v)} /></Field>
          </div>
          <Field label="Building name"><TF value={edit.housing_building} onChange={v => set("housing_building", v)} /></Field>
          <Field label="Room number"><TF value={edit.housing_room} onChange={v => set("housing_room", v)} /></Field>
          <Field label="Passcode"><TF value={edit.housing_passcode} onChange={v => set("housing_passcode", v)} /></Field>
          <Field label="Rent (¥)">
            <input
              type="number"
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"
              value={edit.rent ?? ""}
              onChange={e => set("rent" as keyof EditState, e.target.value ? String(parseInt(e.target.value)) : null)}
            />
          </Field>
          <Field label="Move-in date"><TF value={edit.move_in_date} onChange={v => set("move_in_date", v)} /></Field>
        </Section>

        <Section title="Utilities">
          <Field label="Electricity"><TF value={edit.electricity_date} onChange={v => set("electricity_date", v)} /></Field>
          <Field label="Water"><TF value={edit.water_date} onChange={v => set("water_date", v)} /></Field>
          <div className="col-span-2">
            <Field label="Gas appointment">
              <TF value={edit.gas_appointment} onChange={v => set("gas_appointment", v)} textarea />
              {edit.gas_appointment && (() => {
                const g = parseGasAppointment(edit.gas_appointment)
                if (!g.date && !g.time && !g.hasDeposit) return null
                return (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {g.date && <span className="px-2 py-0.5 rounded bg-[var(--bg-2)] text-[0.68rem] text-[var(--text-2)]">📅 {g.date}</span>}
                    {g.time && <span className="px-2 py-0.5 rounded bg-[var(--bg-2)] text-[0.68rem] text-[var(--text-2)]">🕐 {g.time}</span>}
                    {g.hasDeposit && (
                      <span className={cn("px-2 py-0.5 rounded text-[0.68rem]", g.depositAmount ? "bg-amber-500/15 text-amber-400" : "bg-[var(--bg-2)] text-[var(--text-2)]")}>
                        保証金 {g.depositAmount ?? "あり"}
                      </span>
                    )}
                  </div>
                )
              })()}
            </Field>
          </div>
          <Field label="Gas deposit"><TF value={edit.gas_deposit} onChange={v => set("gas_deposit", v)} /></Field>
        </Section>

        {/* Payroll — sensitive, hidden by default */}
        <div>
          <button
            onClick={() => setShowPayroll(p => !p)}
            className="flex items-center gap-1.5 label-xs mb-2 border-b border-[var(--border)] pb-1 w-full hover:text-[var(--text)] transition-colors"
          >
            Payroll
            <Icon name={showPayroll ? "expand_less" : "expand_more"} size={14} />
          </button>
          {showPayroll && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 pr-8 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"
                      value={edit.payroll_password ?? ""}
                      onChange={e => set("payroll_password", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                    >
                      <Icon name={showPassword ? "visibility_off" : "visibility"} size={14} />
                    </button>
                  </div>
                </Field>
              </div>
              <Field label="Pre-join ID"><TF value={edit.payroll_pre_id} onChange={v => set("payroll_pre_id", v)} /></Field>
              <Field label="Post-join ID"><TF value={edit.payroll_post_id} onChange={v => set("payroll_post_id", v)} /></Field>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3">
        {confirmDelete ? (
          <>
            <span className="text-[0.75rem] text-red-400">Delete this record?</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
              <button onClick={doDelete} disabled={deleting} className="px-3 py-1.5 rounded text-[0.75rem] bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </>
        ) : (
          <>
            {!isNew && (
              <button onClick={() => setConfirmDelete(true)} className="text-[0.72rem] text-[var(--text-3)] hover:text-red-400 transition-colors">Delete</button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {err && <span className="text-[0.72rem] text-red-400">{err}</span>}
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded text-[0.75rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
              >
                {saving ? "Saving…" : isNew ? "Add worker" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

type FilePreview = { file: File; workers: Partial<Worker>[]; fileType: string }

const FILE_TYPE_DESC: Record<string, string> = {
  export:     "Backup export — all fields including status/notes will be restored.",
  company:    "Company CSV — existing status/notes/pledge etc. will be preserved.",
  management: "Management sheet (管理シート) — pledge, My Number, WhatsApp, utilities.",
  database:   "Team database (データベース) — store, area, housing, status.",
  unknown:    "Unknown format — will be skipped.",
}

function ImportTab({ onImported }: { onImported: (workers: Worker[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)

  function readFile(file: File): Promise<FilePreview> {
    return new Promise(resolve => {
      const buf = new FileReader()
      buf.onload = e => {
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer)
        // Detect encoding: UTF-8 BOM → UTF-8, otherwise try UTF-8 then fall back to Shift-JIS
        let text: string
        const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
        if (hasUtf8Bom) {
          text = new TextDecoder("utf-8").decode(bytes)
        } else {
          const utf8 = new TextDecoder("utf-8").decode(bytes)
          // If lots of replacement chars, it's probably Shift-JIS
          const replacements = (utf8.match(/�/g) ?? []).length
          text = replacements > 5 ? new TextDecoder("shift-jis").decode(bytes) : utf8
        }
        const { workers, fileType } = parseWorkersFromCsv(text)
        resolve({ file, workers, fileType })
      }
      buf.readAsArrayBuffer(file)
    })
  }

  async function handleFiles(files: FileList | File[]) {
    setResults([]); setErr(null)
    const parsed = await Promise.all(Array.from(files).map(readFile))
    const valid = parsed.filter(p => p.fileType !== "unknown" && p.workers.length > 0)
    const invalid = parsed.filter(p => p.fileType === "unknown" || p.workers.length === 0)
    if (invalid.length) setErr(`${invalid.map(p => p.file.name).join(", ")} — could not be parsed, skipped.`)
    setPreviews(valid)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  async function doImport() {
    setImporting(true); setErr(null); setResults([])
    const msgs: string[] = []
    for (const { file, workers, fileType } of previews) {
      const res = await upsertWorkers(
        workers as Omit<Worker, "id" | "created_at" | "updated_at" | "team_id">[],
        { preserveTracking: fileType === "company" }
      )
      if ("error" in res) { setErr(`${file.name}: ${res.error}`); setImporting(false); return }
      msgs.push(`${file.name}: ${res.count} workers`)
    }
    setImporting(false)
    setResults(msgs)
    setPreviews([])
    const updated = await getWorkers()
    onImported(updated)
  }

  const totalWorkers = previews.reduce((n, p) => n + p.workers.length, 0)

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-[var(--border)] rounded-lg p-10 text-center cursor-pointer hover:border-[var(--text-3)] transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = "" }}
        />
        <Icon name="upload_file" size={32} className="mx-auto mb-2 text-[var(--text-3)]" />
        <p className="text-[0.85rem] text-[var(--text-2)]">Drop CSV files here, or click to browse</p>
        <p className="text-[0.72rem] text-[var(--text-3)] mt-1">
          Multiple files supported · Company CSV · データベース · 管理シート · Backup export
        </p>
      </div>

      {err && <p className="text-[0.8rem] text-red-400">{err}</p>}
      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r, i) => <p key={i} className="text-[0.8rem] text-emerald-400">{r}</p>)}
        </div>
      )}

      {previews.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[0.8rem] text-[var(--text-2)]">
              <span className="text-[var(--text)] font-medium">{totalWorkers} workers</span> across {previews.length} file{previews.length > 1 ? "s" : ""}
            </p>
            <button
              onClick={doImport}
              disabled={importing}
              className="px-4 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 font-medium transition-opacity"
            >
              {importing ? "Importing…" : `Import all ${totalWorkers} workers`}
            </button>
          </div>

          {/* Per-file previews */}
          {previews.map(({ file, workers, fileType }) => (
            <div key={file.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-[0.78rem] font-medium text-[var(--text)]">{file.name}</p>
                <p className="text-[0.7rem] text-[var(--text-3)]">{workers.length} workers · {FILE_TYPE_DESC[fileType] ?? ""}</p>
              </div>
              <div className="overflow-x-auto rounded border border-[var(--border)]">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-2)]">
                      {["Name", "Worker ID", "Store", "Staff", "Payroll user", "Leopalace"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-[var(--text-2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workers.slice(0, 10).map((w, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)]">
                        <td className="px-3 py-2 text-[var(--text)]">{w.name_latin ?? w.name_kana ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-2)] font-mono">{w.worker_id ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-2)]">{w.store_name ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-2)]">{w.support_staff ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-2)]">{w.payroll_pre_id ? <span className="font-mono">{w.payroll_pre_id}</span> : <span className="text-[var(--text-3)]">—</span>}</td>
                        <td className="px-3 py-2 text-[var(--text-2)]">{w.leopalace_url ? <span className="text-emerald-500">✓</span> : <span className="text-[var(--text-3)]">—</span>}</td>
                      </tr>
                    ))}
                    {workers.length > 10 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-[var(--text-3)] text-center">
                          + {workers.length - 10} more…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Worker ID sort ───────────────────────────────────────────────────────────
// Format: I1, I2 … (batch 1) then 2I1, 2I2 … (batch 2) then 3I1 … etc.
// Rows without a worker_id sort to the end.
function parseWorkerId(id: string | null | undefined): [number, number] {
  if (!id) return [9999, 9999]
  const m = id.trim().match(/^(\d*)I(\d+)$/i)
  if (!m) return [9999, 9999]
  return [m[1] ? parseInt(m[1]) : 1, parseInt(m[2])]
}

function sortByWorkerId(a: Worker, b: Worker): number {
  const [ab, an] = parseWorkerId(a.worker_id)
  const [bb, bn] = parseWorkerId(b.worker_id)
  return ab !== bb ? ab - bb : an - bn
}


// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = { key: keyof Worker; label: string; defaultOn: boolean; render?: (w: Worker) => React.ReactNode }

function calcAge(birthDate: string | null | undefined): string {
  if (!birthDate) return ""
  const b = new Date(birthDate), today = new Date()
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return `${birthDate} (${age})`
}

// Frozen cols stay sticky on left while scrolling horizontally
const FROZEN_KEYS = new Set<keyof Worker>(["worker_id", "name_latin", "name_kana"])
const DEFAULT_COL_WIDTH = 140
const ROW_NUM_WIDTH = 40
const CHECKBOX_COL_WIDTH = 28
const LS_COL_WIDTHS = "people_col_widths"

function stickyLeft(key: keyof Worker, visibleCols: Set<keyof Worker>, colWidths: Record<string, number>): number {
  let left = CHECKBOX_COL_WIDTH + ROW_NUM_WIDTH
  for (const fk of ["worker_id", "name_latin", "name_kana"] as Array<keyof Worker>) {
    if (fk === key) break
    if (visibleCols.has(fk)) left += colWidths[fk as string] ?? DEFAULT_COL_WIDTH
  }
  return left
}

function ResizeHandle({ startWidth, onResize }: { startWidth: number; onResize: (w: number) => void }) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    function onMove(ev: MouseEvent) { onResize(Math.max(50, startWidth + (ev.clientX - startX))) }
    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }
  return (
    <div onMouseDown={onMouseDown} className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group flex items-center justify-end pr-0.5">
      <div className="w-px h-3/4 bg-transparent group-hover:bg-[var(--text-3)] transition-colors" />
    </div>
  )
}

const ALL_COLS: ColDef[] = [
  { key: "worker_id",          label: "ID",            defaultOn: true },
  { key: "name_latin",         label: "Latin name",    defaultOn: true },
  { key: "name_kana",          label: "Name (JP)",     defaultOn: true },
  { key: "nickname",           label: "Nickname",      defaultOn: true },
  { key: "gender",             label: "Gender",        defaultOn: true },
  { key: "birth_date",         label: "Birth date",    defaultOn: true, render: (w) => <span className="text-[var(--text-2)]">{calcAge(w.birth_date)}</span> },
  { key: "mobile_phone",       label: "Phone",         defaultOn: true },
  { key: "whatsapp",           label: "WhatsApp",      defaultOn: true },
  { key: "email",              label: "Email",         defaultOn: true },
  { key: "store_name",         label: "Store",         defaultOn: true },
  { key: "store_code",         label: "Store code",    defaultOn: true },
  { key: "store_address",      label: "Store address", defaultOn: true },
  { key: "area",               label: "Area",          defaultOn: true },
  { key: "support_staff",      label: "Staff",         defaultOn: true },
  { key: "status",             label: "Status",        defaultOn: true, render: (w) => <StatusChip status={w.status} /> },
  { key: "first_work_date",    label: "First day",     defaultOn: true },
  { key: "move_in_date",       label: "Move-in date",  defaultOn: true },
  { key: "assignment_month",   label: "Batch month",   defaultOn: true },
  { key: "arrival_group",      label: "入国グループ",     defaultOn: true },
  { key: "japan_arrival_date", label: "Arrival date",    defaultOn: true },
  { key: "commute_method",     label: "Commute method",  defaultOn: true },
  { key: "commute_distance",   label: "Commute dist",    defaultOn: true },
  { key: "leopalace_url",      label: "Leopalace URL",   defaultOn: false },
  { key: "housing_building",   label: "Building",        defaultOn: true },
  { key: "housing_room",       label: "Room",            defaultOn: true },
  { key: "housing_address",    label: "Address",         defaultOn: true },
  { key: "electricity_date",   label: "Electricity",     defaultOn: true },
  { key: "water_date",         label: "Water",           defaultOn: true },
  { key: "gas_appointment",    label: "Gas",             defaultOn: true },
  { key: "signal_status",      label: "Signal",          defaultOn: true },
  { key: "mynumber_status",    label: "My Number",       defaultOn: true },
  { key: "pledge_done",        label: "Pledge",          defaultOn: true, render: (w) => <Dot ok={!!w.pledge_done} /> },
  { key: "payroll_pre_id",     label: "Payroll pre-ID",  defaultOn: true },
  { key: "payroll_post_id",    label: "Payroll post-ID", defaultOn: true },
  { key: "payroll_password",   label: "Password",        defaultOn: true, render: (w) => w.payroll_password
    ? <PasswordCell value={w.payroll_password} />
    : null
  },
]

const MASTER_COLS = new Set(ALL_COLS.map(c => c.key))

// ─── Views ────────────────────────────────────────────────────────────────────

type ViewPreset = { name: string; cols: Array<keyof Worker> }
const LS_VIEWS = "people_views"
const LS_ACTIVE_VIEW = "people_active_view"

function loadViews(): ViewPreset[] {
  try { return JSON.parse(localStorage.getItem(LS_VIEWS) ?? "[]") } catch { return [] }
}
function saveViews(views: ViewPreset[]) {
  localStorage.setItem(LS_VIEWS, JSON.stringify(views))
}

function ViewPicker({
  visible, onChange,
}: {
  visible: Set<keyof Worker>
  onChange: (cols: Set<keyof Worker>, viewName?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<ViewPreset[]>([])
  const [activeView, setActiveView] = useState<string>("Master")
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViews(loadViews())
    setActiveView(localStorage.getItem(LS_ACTIVE_VIEW) ?? "Master")
  }, [])

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setNaming(false) } }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  function selectView(name: string, cols: Set<keyof Worker>) {
    setActiveView(name)
    localStorage.setItem(LS_ACTIVE_VIEW, name)
    onChange(cols, name)
    setOpen(false)
  }

  function saveCurrentAsView() {
    if (!newName.trim()) return
    const updated = [...views.filter(v => v.name !== newName.trim()), { name: newName.trim(), cols: [...visible] }]
    setViews(updated)
    saveViews(updated)
    setActiveView(newName.trim())
    localStorage.setItem(LS_ACTIVE_VIEW, newName.trim())
    setNaming(false)
    setNewName("")
    setOpen(false)
  }

  function deleteView(name: string) {
    const updated = views.filter(v => v.name !== name)
    setViews(updated)
    saveViews(updated)
    if (activeView === name) selectView("Master", MASTER_COLS)
  }

  function toggleCol(key: keyof Worker) {
    const next = new Set(visible)
    if (next.has(key)) next.delete(key); else next.add(key)
    setActiveView("Custom")
    localStorage.setItem(LS_ACTIVE_VIEW, "Custom")
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1 text-[0.72rem] transition-colors",
          open ? "text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
        )}
      >
        <Icon name="table_chart" size={13} />
        {activeView}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg w-64 flex flex-col overflow-hidden">
          {/* Saved views */}
          <div className="p-2 flex flex-col gap-0.5 border-b border-[var(--border)]">
            <p className="label-xs px-2 pb-1">Views</p>
            <button
              onClick={() => selectView("Master", MASTER_COLS)}
              className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-[0.78rem] text-left transition-colors",
                activeView === "Master" ? "bg-[var(--text)] text-[var(--bg)]" : "hover:bg-[var(--bg-2)] text-[var(--text)]"
              )}
            >
              <Icon name="grid_on" size={13} />
              Master — all columns
            </button>
            {views.map(v => (
              <div key={v.name} className={cn("flex items-center rounded transition-colors",
                activeView === v.name ? "bg-[var(--text)]" : "hover:bg-[var(--bg-2)]"
              )}>
                <button
                  onClick={() => selectView(v.name, new Set(v.cols))}
                  className={cn("flex-1 px-2 py-1.5 text-[0.78rem] text-left",
                    activeView === v.name ? "text-[var(--bg)]" : "text-[var(--text)]"
                  )}
                >
                  {v.name}
                </button>
                <button
                  onClick={() => deleteView(v.name)}
                  className={cn("px-2 py-1.5 transition-colors",
                    activeView === v.name ? "text-[var(--bg)]/60 hover:text-[var(--bg)]" : "text-[var(--text-3)] hover:text-red-400"
                  )}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Column toggles */}
          <div className="p-2 flex flex-col gap-0.5 max-h-64 overflow-y-auto border-b border-[var(--border)]">
            <p className="label-xs px-2 pb-1">Columns</p>
            {ALL_COLS.map(col => (
              <label key={col.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--bg-2)] cursor-pointer text-[0.78rem] text-[var(--text)]">
                <input type="checkbox" checked={visible.has(col.key)} onChange={() => toggleCol(col.key)} className="accent-[var(--text)]" />
                {col.label}
              </label>
            ))}
          </div>

          {/* Save as view */}
          <div className="p-2">
            {naming ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveCurrentAsView(); if (e.key === "Escape") setNaming(false) }}
                  placeholder="View name…"
                  className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1 text-[0.75rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]"
                />
                <button onClick={saveCurrentAsView} className="px-2 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium">Save</button>
              </div>
            ) : (
              <button
                onClick={() => setNaming(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors"
              >
                <Icon name="add" size={13} />
                Save current columns as view…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function loadVisibleCols(): Set<keyof Worker> {
  try {
    const activeView = localStorage.getItem(LS_ACTIVE_VIEW) ?? "Master"
    if (activeView === "Master" || activeView === "Custom") {
      // For master: return all; for custom: nothing saved separately, return all as fallback
      if (activeView === "Master") return new Set(MASTER_COLS)
    }
    const views: ViewPreset[] = JSON.parse(localStorage.getItem(LS_VIEWS) ?? "[]")
    const found = views.find(v => v.name === activeView)
    if (found) return new Set(found.cols)
  } catch { /* ignore */ }
  return new Set(MASTER_COLS)
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "workers" | "import" | "stores"

export default function PeoplePage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("workers")
  const [search, setSearch] = useState("")
  const [filterStaff, setFilterStaff] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [selected, setSelected] = useState<Worker | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<keyof Worker>>(MASTER_COLS)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [editingCell, setEditingCell] = useState<{ id: string; key: keyof Worker } | null>(null)
  const [cellSel, setCellSel] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null)
  const cellAnchor = useRef<{ ri: number; ci: number } | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const undoStackRef = useRef<Array<Array<{ id: string; key: keyof Worker; oldVal: unknown }>>>([])
  const undoLastRef = useRef<() => void>(() => {})

  useEffect(() => {
    setVisibleCols(loadVisibleCols())
    try { const saved = localStorage.getItem(LS_COL_WIDTHS); if (saved) setColWidths(JSON.parse(saved)) } catch { /* ignore */ }
    getWorkersDebug().then(result => {
      if ("_error" in result) {
        setLoadError(result._error)
      } else {
        setWorkers(result.workers)
      }
      setLoading(false)
    }).catch(e => { setLoadError(String(e)); setLoading(false) })
  }, [])

  function resizeCol(key: string, w: number) {
    const next = { ...colWidths, [key]: w }
    setColWidths(next)
    localStorage.setItem(LS_COL_WIDTHS, JSON.stringify(next))
  }

  const activeCols = useMemo(
    () => ALL_COLS.filter(c => visibleCols.has(c.key)),
    [visibleCols]
  )

  // Derived staff list
  const staffList = useMemo(
    () => Array.from(new Set(workers.map(w => w.support_staff).filter(Boolean))) as string[],
    [workers]
  )

  const filtered = useMemo(() => workers.filter(w => {
    if (filterStaff && w.support_staff !== filterStaff) return false
    if (filterStatus && w.status !== filterStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (w.name_kana ?? "").toLowerCase().includes(q) ||
      (w.name_latin ?? "").toLowerCase().includes(q) ||
      (w.nickname ?? "").toLowerCase().includes(q) ||
      (w.store_name ?? "").toLowerCase().includes(q) ||
      (w.store_code ?? "").toLowerCase().includes(q) ||
      (w.area ?? "").toLowerCase().includes(q) ||
      (w.housing_building ?? "").toLowerCase().includes(q) ||
      (w.worker_id ?? "").toLowerCase().includes(q)
    )
  }).sort(sortByWorkerId), [workers, search, filterStaff, filterStatus])

  function navigateCell(dir: "next" | "prev" | "down") {
    if (!editingCell) return
    const editableCols = activeCols.filter(c => c.key !== "pledge_done")
    const ri = filtered.findIndex(w => w.id === editingCell.id)
    const ci = editableCols.findIndex(c => c.key === editingCell.key)
    setCellSel(null)
    if (ri < 0 || ci < 0) { setEditingCell(null); return }
    if (dir === "next") {
      if (ci + 1 < editableCols.length) setEditingCell({ id: filtered[ri].id, key: editableCols[ci + 1].key })
      else if (ri + 1 < filtered.length) setEditingCell({ id: filtered[ri + 1].id, key: editableCols[0].key })
      else setEditingCell(null)
    } else if (dir === "prev") {
      if (ci - 1 >= 0) setEditingCell({ id: filtered[ri].id, key: editableCols[ci - 1].key })
      else if (ri - 1 >= 0) setEditingCell({ id: filtered[ri - 1].id, key: editableCols[editableCols.length - 1].key })
      else setEditingCell(null)
    } else {
      if (ri + 1 < filtered.length) setEditingCell({ id: filtered[ri + 1].id, key: editableCols[ci].key })
      else setEditingCell(null)
    }
  }

  function selectCell(ri: number, ci: number) {
    cellAnchor.current = { ri, ci }
    setCellSel({ r1: ri, c1: ci, r2: ri, c2: ci })
    setEditingCell(null)
  }

  function extendSel(ri: number, ci: number) {
    if (!cellAnchor.current) { selectCell(ri, ci); return }
    const { ri: ar, ci: ac } = cellAnchor.current
    setCellSel({ r1: Math.min(ar, ri), c1: Math.min(ac, ci), r2: Math.max(ar, ri), c2: Math.max(ac, ci) })
    setEditingCell(null)
  }

  // Ctrl+C / Cmd+C: copies cell selection as TSV, or checked rows as fallback
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== "c" && e.key !== "C")) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      e.preventDefault()

      if (cellSel) {
        const selCols = activeCols.slice(cellSel.c1, cellSel.c2 + 1)
        const selRows = filtered.slice(cellSel.r1, cellSel.r2 + 1)
        const tsv = selRows.map(w =>
          selCols.map(c => {
            const v = w[c.key]
            if (v === null || v === undefined) return ""
            if (typeof v === "boolean") return v ? "Y" : ""
            return String(v)
          }).join("\t")
        ).join("\n")
        navigator.clipboard.writeText(tsv)
        const cells = (cellSel.r2 - cellSel.r1 + 1) * (cellSel.c2 - cellSel.c1 + 1)
        setCopyFeedback(`Copied ${cells} cell${cells > 1 ? "s" : ""}`)
        setTimeout(() => setCopyFeedback(null), 2000)
        return
      }

      if (checkedIds.size === 0) return
      const checkedWorkers = filtered.filter(w => checkedIds.has(w.id))
      const headers = activeCols.map(c => c.label)
      const rows = checkedWorkers.map(w =>
        activeCols.map(c => {
          const v = w[c.key]
          if (v === null || v === undefined) return ""
          if (typeof v === "boolean") return v ? "Y" : ""
          return String(v)
        })
      )
      const tsv = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n")
      navigator.clipboard.writeText(tsv)
      const msg = `Copied ${checkedWorkers.length} row${checkedWorkers.length > 1 ? "s" : ""}`
      setCopyFeedback(msg)
      setTimeout(() => setCopyFeedback(null), 2000)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [cellSel, checkedIds, filtered, activeCols])

  // Arrow keys / Enter / Escape for cell selection navigation
  useEffect(() => {
    function handleNav(e: KeyboardEvent) {
      if (editingCell) return
      if (!cellSel) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(e.key)) return
      e.preventDefault()
      if (e.key === "Escape") { setCellSel(null); cellAnchor.current = null; return }
      if (e.key === "Enter") {
        const col = activeCols[cellSel.c1]
        if (col && col.key !== "pledge_done" && filtered[cellSel.r1]) {
          setEditingCell({ id: filtered[cellSel.r1].id, key: col.key })
        }
        return
      }
      let nr = cellSel.r1, nc = cellSel.c1
      if (e.key === "ArrowDown")  nr = Math.min(nr + 1, filtered.length - 1)
      if (e.key === "ArrowUp")    nr = Math.max(nr - 1, 0)
      if (e.key === "ArrowRight") nc = Math.min(nc + 1, activeCols.length - 1)
      if (e.key === "ArrowLeft")  nc = Math.max(nc - 1, 0)
      cellAnchor.current = { ri: nr, ci: nc }
      setCellSel({ r1: nr, c1: nc, r2: nr, c2: nc })
    }
    document.addEventListener("keydown", handleNav)
    return () => document.removeEventListener("keydown", handleNav)
  }, [cellSel, editingCell, filtered, activeCols])

  // Ctrl+Z / Cmd+Z: undo last inline edit or paste
  useEffect(() => {
    function handleUndo(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== "z" && e.key !== "Z")) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      e.preventDefault()
      undoLastRef.current()
    }
    document.addEventListener("keydown", handleUndo)
    return () => document.removeEventListener("keydown", handleUndo)
  }, [])

  // Ctrl+V pastes TSV from clipboard into table starting at selection anchor
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      if (editingCell) return
      if (!cellSel) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      const text = e.clipboardData?.getData("text/plain")
      if (!text?.trim()) return
      e.preventDefault()

      const pasteRows = text.trimEnd().split(/\r?\n/).map(r => r.split("\t"))
      const startRi = cellSel.r1
      const startCi = cellSel.c1

      const rowUpdates: Map<string, Partial<Worker>> = new Map()
      let endRi = startRi, endCi = startCi

      for (let dr = 0; dr < pasteRows.length; dr++) {
        const ri = startRi + dr
        if (ri >= filtered.length) break
        const worker = filtered[ri]
        const patch: Partial<Worker> = {}
        for (let dc = 0; dc < pasteRows[dr].length; dc++) {
          const ci = startCi + dc
          if (ci >= activeCols.length) break
          const col = activeCols[ci]
          if (col.key === "pledge_done") continue
          const raw = pasteRows[dr][dc]
          const key = col.key as WKey
          const isDate = DATE_FIELDS.has(key)
          const clean: string | null = isDate ? (normalizeDate(raw) ?? (raw || null)) : (raw || null)
          patch[key] = clean as never
          endCi = Math.max(endCi, ci)
        }
        if (Object.keys(patch).length > 0) rowUpdates.set(worker.id, patch)
        endRi = Math.max(endRi, ri)
      }

      // Capture old values for undo before overwriting
      const undoEntries: Array<{ id: string; key: keyof Worker; oldVal: unknown }> = []
      for (const [wId, patch] of rowUpdates) {
        const oldWorker = filtered.find(fw => fw.id === wId)
        if (!oldWorker) continue
        for (const key of Object.keys(patch) as Array<keyof Worker>) {
          undoEntries.push({ id: wId, key, oldVal: oldWorker[key] })
        }
      }
      if (undoEntries.length > 0) {
        undoStackRef.current.push(undoEntries)
        if (undoStackRef.current.length > 50) undoStackRef.current.shift()
      }

      // Optimistic update + fire-and-forget saves
      setWorkers(ws => ws.map(w => {
        const patch = rowUpdates.get(w.id)
        return patch ? { ...w, ...patch } : w
      }))
      for (const [id, patch] of rowUpdates) updateWorker(id, patch)

      // Highlight the pasted range
      cellAnchor.current = { ri: startRi, ci: startCi }
      setCellSel({ r1: startRi, c1: startCi, r2: endRi, c2: endCi })
      const cells = (endRi - startRi + 1) * (endCi - startCi + 1)
      setCopyFeedback(`Pasted ${cells} cell${cells > 1 ? "s" : ""}`)
      setTimeout(() => setCopyFeedback(null), 2000)
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [cellSel, editingCell, filtered, activeCols])

  function applyWorkerUpdate(updated: Worker) {
    setWorkers(ws => ws.map(w => w.id === updated.id ? updated : w))
    if (selected?.id === updated.id) setSelected(updated)
  }

  function undoLast() {
    const entries = undoStackRef.current.pop()
    if (!entries?.length) return
    const patchMap = new Map<string, Partial<Worker>>()
    for (const { id, key, oldVal } of entries) {
      if (!patchMap.has(id)) patchMap.set(id, {})
      patchMap.get(id)![key] = oldVal as never
    }
    setWorkers(ws => ws.map(w => {
      const p = patchMap.get(w.id)
      return p ? { ...w, ...p } : w
    }))
    for (const [id, p] of patchMap) updateWorker(id, p)
    setCopyFeedback("Undone")
    setTimeout(() => setCopyFeedback(null), 2000)
  }
  undoLastRef.current = undoLast

  function handleSaved(updated: Worker) {
    setAddingNew(false)
    setWorkers(ws => {
      const exists = ws.some(w => w.id === updated.id)
      return exists ? ws.map(w => w.id === updated.id ? updated : w) : [...ws, updated]
    })
    setSelected(updated)
  }

  function handleDeleted(id: string) {
    setWorkers(ws => ws.filter(w => w.id !== id))
    setSelected(null)
    setCheckedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function toggleCheckAll() {
    setCheckedIds(checkedIds.size === filtered.length ? new Set() : new Set(filtered.map(w => w.id)))
  }

  async function deleteBulk() {
    setBulkDeleting(true)
    for (const id of checkedIds) await deleteWorker(id)
    const gone = new Set(checkedIds)
    setWorkers(ws => ws.filter(w => !gone.has(w.id)))
    if (selected && gone.has(selected.id)) setSelected(null)
    setCheckedIds(new Set())
    setConfirmBulkDelete(false)
    setBulkDeleting(false)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-48px)]">
      <PageHeader
        full
        title="People"
        right={
          <PillTabs
            options={[
              { value: "workers", label: `Workers${workers.length ? ` (${workers.length})` : ""}` },
              { value: "stores",  label: "Stores (店舗)" },
              { value: "import",  label: "Import CSV" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <ToolContent full className="overflow-hidden">
        {tab === "import" ? (
          <div className="overflow-y-auto py-6">
            <ImportTab onImported={ws => { setWorkers(ws); setTab("workers") }} />
          </div>
        ) : tab === "stores" ? (
          <div className="overflow-y-auto py-6">
            <StoresTab />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Main list */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              {/* Filters bar */}
              <div className="shrink-0 py-3 flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                  <input
                    className="bg-[var(--bg-2)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] w-52 transition-colors"
                    placeholder="Name, store, area…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]">
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>

                {/* Staff filter */}
                {staffList.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStaff(f => f === s ? null : s)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all border",
                      filterStaff === s
                        ? "bg-[var(--text)] text-[var(--bg)] border-[var(--text)]"
                        : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]"
                    )}
                  >
                    {s}
                  </button>
                ))}

                {/* Status filter */}
                {["要確認", "問題あり"].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(f => f === s ? null : s)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                      filterStatus === s
                        ? STATUS_COLOR[s]
                        : "text-[var(--text-3)] hover:text-[var(--text-2)]"
                    )}
                  >
                    {s}
                  </button>
                ))}

                {(filterStaff || filterStatus) && (
                  <button onClick={() => { setFilterStaff(null); setFilterStatus(null) }} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                    Clear
                  </button>
                )}

                {checkedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[0.72rem] text-[var(--text-2)]">{checkedIds.size} selected</span>
                    {copyFeedback ? (
                      <span className="text-[0.72rem] text-green-400">{copyFeedback}</span>
                    ) : (
                      <span className="text-[0.65rem] text-[var(--text-3)]">Ctrl+C to copy</span>
                    )}
                    {confirmBulkDelete ? (
                      <>
                        <span className="text-[0.72rem] text-red-400">Delete {checkedIds.size} workers?</span>
                        <button onClick={deleteBulk} disabled={bulkDeleting} className="px-2.5 py-1 rounded text-[0.72rem] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                          {bulkDeleting ? "Deleting…" : "Confirm"}
                        </button>
                        <button onClick={() => setConfirmBulkDelete(false)} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmBulkDelete(true)} className="px-2.5 py-1 rounded text-[0.72rem] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Delete</button>
                        <button onClick={() => setCheckedIds(new Set())} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">Clear</button>
                      </>
                    )}
                  </div>
                )}

                {copyFeedback && checkedIds.size === 0 && (
                  <span className="text-[0.72rem] text-emerald-400">{copyFeedback}</span>
                )}

                <span className="ml-auto text-[0.72rem] text-[var(--text-3)]">
                  {loading ? "Loading…" : `${filtered.length} of ${workers.length}`}
                </span>

                <ViewPicker visible={visibleCols} onChange={(cols) => setVisibleCols(cols)} />

                {workers.length > 0 && (
                  <>
                    <button
                      onClick={async () => {
                        const res = await exportWorkersCsv()
                        if ("error" in res) return
                        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url; a.download = res.filename; a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors flex items-center gap-1"
                    >
                      <Icon name="download" size={13} />
                      Export
                    </button>
                    <button
                      onClick={async () => {
                        setSyncing(true); setSyncMsg(null)
                        const res = await syncWorkerStoreInfo()
                        setSyncing(false)
                        if ("error" in res) { setSyncMsg(`Error: ${res.error}`); return }
                        setSyncMsg(`Updated ${res.updated} workers`)
                        setTimeout(() => setSyncMsg(null), 4000)
                        const updated = await getWorkers()
                        setWorkers(updated)
                      }}
                      disabled={syncing}
                      className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Icon name="store" size={13} />
                      {syncing ? "Syncing…" : "Sync stores"}
                    </button>
                    {syncMsg && <span className={cn("text-[0.72rem]", syncMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400")}>{syncMsg}</span>}
                  </>
                )}

                <button
                  onClick={() => { setAddingNew(true); setSelected(null) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[0.72rem] font-medium bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity"
                >
                  <Icon name="add" size={13} />
                  Add
                </button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-48 gap-2 text-[var(--text-3)]">
                    <span className="inline-block w-4 h-4 border-2 border-[var(--border)] border-t-[var(--text-3)] rounded-full animate-spin" />
                    <span className="text-[0.85rem]">Loading…</span>
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-3)]">
                    <p className="text-[0.85rem] text-red-400">Failed to load workers</p>
                    <p className="text-[0.72rem] font-mono text-[var(--text-3)] max-w-md text-center break-all">{loadError}</p>
                    <button
                      onClick={() => { setLoadError(null); setLoading(true); getWorkersDebug().then(r => { if ("_error" in r) setLoadError(r._error); else setWorkers(r.workers); setLoading(false) }).catch(e => { setLoadError(String(e)); setLoading(false) }) }}
                      className="px-4 py-2 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 font-medium"
                    >
                      Retry
                    </button>
                  </div>
                ) : workers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-3)]">
                    <Icon name="group" size={32} />
                    <p className="text-[0.85rem]">No workers yet — import a CSV to get started</p>
                    <button
                      onClick={() => setTab("import")}
                      className="px-4 py-2 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 font-medium"
                    >
                      Import CSV
                    </button>
                  </div>
                ) : (
                  <table className="border-collapse text-[0.78rem]" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {/* Checkbox — sticky leftmost */}
                        <th className="sticky left-0 z-30 border-r border-b border-[var(--border)] bg-[var(--bg-2)] text-center"
                          style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH }}>
                          <input
                            type="checkbox"
                            checked={filtered.length > 0 && checkedIds.size === filtered.length}
                            ref={el => { if (el) el.indeterminate = checkedIds.size > 0 && checkedIds.size < filtered.length }}
                            onChange={toggleCheckAll}
                            className="accent-[var(--text)]"
                          />
                        </th>
                        {/* Row number */}
                        <th className="sticky z-30 border-r border-b border-[var(--border)] bg-[var(--bg-2)]"
                          style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH, left: CHECKBOX_COL_WIDTH }} />
                        {activeCols.map(col => {
                          const frozen = FROZEN_KEYS.has(col.key)
                          const w = colWidths[col.key as string] ?? DEFAULT_COL_WIDTH
                          return (
                            <th
                              key={col.key}
                              className={cn(
                                "border-r border-b border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-left text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-2)] whitespace-nowrap select-none relative",
                                frozen && "sticky z-30"
                              )}
                              style={{
                                width: w, minWidth: 50,
                                ...(frozen ? { left: stickyLeft(col.key, visibleCols, colWidths) } : {})
                              }}
                            >
                              {col.label}
                              <ResizeHandle startWidth={w} onResize={nw => resizeCol(col.key as string, nw)} />
                            </th>
                          )
                        })}
                        <th className="border-b border-[var(--border)] bg-[var(--bg-2)]" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((w, ri) => {
                        const isSelected = selected?.id === w.id
                        const rowBg = isSelected ? "color-mix(in srgb, var(--highlight) 12%, var(--bg))" : undefined
                        return (
                          <tr key={w.id} className={cn(!isSelected && !checkedIds.has(w.id) && "hover:bg-[var(--bg-2)]")}>
                            {/* Checkbox */}
                            <td
                              onClick={e => { e.stopPropagation(); toggleCheck(w.id) }}
                              className="sticky left-0 z-10 border-r border-b border-[var(--border)] text-center select-none cursor-pointer"
                              style={{ width: CHECKBOX_COL_WIDTH, minWidth: CHECKBOX_COL_WIDTH, backgroundColor: checkedIds.has(w.id) ? "color-mix(in srgb, var(--highlight) 12%, var(--bg))" : "var(--bg-2)" }}
                            >
                              <input type="checkbox" checked={checkedIds.has(w.id)} onChange={() => toggleCheck(w.id)} className="accent-[var(--text)] pointer-events-none" />
                            </td>
                            {/* Row number — click opens panel */}
                            <td
                              onClick={() => { setSelected(w); setAddingNew(false); setEditingCell(null) }}
                              className="sticky z-10 border-r border-b border-[var(--border)] text-center text-[0.65rem] text-[var(--text-3)] select-none cursor-pointer hover:text-[var(--text)]"
                              style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH, left: CHECKBOX_COL_WIDTH, backgroundColor: isSelected ? "color-mix(in srgb, var(--highlight) 12%, var(--bg))" : "var(--bg-2)" }}
                            >
                              {ri + 1}
                            </td>
                            {activeCols.map((col, ci) => {
                              const frozen = FROZEN_KEYS.has(col.key)
                              const cw = colWidths[col.key as string] ?? DEFAULT_COL_WIDTH
                              const isEditing = editingCell?.id === w.id && editingCell?.key === col.key
                              const isInSel = cellSel ? (ri >= cellSel.r1 && ri <= cellSel.r2 && ci >= cellSel.c1 && ci <= cellSel.c2) : false
                              const cellBg = isInSel
                                ? "color-mix(in srgb, var(--highlight) 22%, var(--bg))"
                                : isSelected ? rowBg : frozen ? "var(--bg)" : undefined

                              // pledge_done: click selects; double-click toggles
                              if (col.key === "pledge_done") {
                                return (
                                  <td key={col.key}
                                    onClick={(e) => { if (e.shiftKey) extendSel(ri, ci); else selectCell(ri, ci) }}
                                    onDoubleClick={async () => {
                                      const updated = { ...w, pledge_done: !w.pledge_done }
                                      await updateWorker(w.id, { pledge_done: !w.pledge_done })
                                      applyWorkerUpdate(updated)
                                    }}
                                    className="border-r border-b border-[var(--border)] px-2 py-1.5 cursor-pointer select-none"
                                    style={{ width: cw, maxWidth: cw, backgroundColor: cellBg, position: frozen ? "sticky" : undefined, left: frozen ? stickyLeft(col.key, visibleCols, colWidths) : undefined }}
                                  >
                                    {col.render!(w)}
                                  </td>
                                )
                              }

                              return (
                                <td
                                  key={col.key}
                                  onClick={(e) => { if (e.shiftKey) extendSel(ri, ci); else selectCell(ri, ci) }}
                                  onDoubleClick={() => setEditingCell({ id: w.id, key: col.key })}
                                  className={cn("border-r border-b border-[var(--border)] whitespace-nowrap overflow-hidden text-ellipsis cursor-default select-none relative", !isEditing && "px-2 py-1.5", frozen && "z-10")}
                                  style={{ width: cw, maxWidth: cw, backgroundColor: cellBg, position: frozen ? "sticky" : undefined, left: frozen ? stickyLeft(col.key, visibleCols, colWidths) : undefined }}
                                >
                                  {isEditing ? (
                                    <EditableCell
                                      worker={w} col={col}
                                      onSaved={updated => {
                                        undoStackRef.current.push([{ id: w.id, key: col.key, oldVal: w[col.key] }])
                                        if (undoStackRef.current.length > 50) undoStackRef.current.shift()
                                        applyWorkerUpdate(updated)
                                        setEditingCell(null)
                                      }}
                                      onEscape={() => setEditingCell(null)}
                                      onNavigate={navigateCell}
                                    />
                                  ) : col.render ? col.render(w) : (
                                    <span className={cn("text-[var(--text-2)]", col.key === "name_latin" && "text-[var(--text)] font-medium")}>
                                      {(w[col.key] as string | number | boolean | null | undefined) != null
                                        ? (col.key === "gender"
                                            ? (normalizeGender(String(w[col.key])) ?? String(w[col.key]))
                                            : DATE_FIELDS.has(col.key as WKey)
                                              ? (normalizeDate(String(w[col.key])) ?? String(w[col.key]))
                                              : String(w[col.key]))
                                        : ""}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="border-b border-[var(--border)]" style={{ backgroundColor: rowBg }} />
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Side panel */}
            {(selected || addingNew) && (
              <div className="w-80 shrink-0 border-l border-[var(--border)] flex flex-col overflow-hidden">
                {addingNew ? (
                  <WorkerPanel
                    onClose={() => setAddingNew(false)}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                  />
                ) : (
                  <WorkerPanel
                    worker={selected!}
                    onClose={() => setSelected(null)}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </ToolContent>
    </div>
  )
}
