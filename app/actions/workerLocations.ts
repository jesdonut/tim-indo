"use server"

import { createClient } from "@/lib/supabase/server"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

export type WorkerLocation = {
  id: string
  worker_id: string
  team_id: string
  move_number: number
  housing_address?: string | null
  housing_postal_code?: string | null
  housing_building?: string | null
  housing_room?: string | null
  housing_passcode?: string | null
  rent?: number | null
  move_in_date?: string | null
  move_out_date?: string | null
  store_code?: string | null
  store_name?: string | null
  store_address?: string | null
  store_postal_code?: string | null
  store_phone?: string | null
  commute_method?: string | null
  commute_distance?: string | null
  commute_route_url?: string | null
  mobile_phone?: string | null
  electricity_date?: string | null
  water_date?: string | null
  gas_appointment?: string | null
  leopalace_url?: string | null
  notes?: string | null

  // Old address (move-out side)
  housing_postal_code_old?: string | null
  housing_address_old?: string | null
  housing_building_old?: string | null
  housing_room_old?: string | null

  // Move logistics
  ido_group?: string | null
  last_work_date?: string | null
  first_work_date?: string | null

  // 荷物
  luggage_pickup_datetime?: string | null
  luggage_delivery_datetime?: string | null
  luggage_received?: boolean | null

  // 電気
  electricity_stop_date?: string | null
  electricity_start_date?: string | null
  electricity_done?: boolean | null

  // 水道
  water_stop_date?: string | null
  water_start_date?: string | null
  water_done?: boolean | null

  // ガス
  gas_stop_date?: string | null
  gas_start_date?: string | null
  gas_tachiai_datetime?: string | null
  gas_tachiai_unnecessary?: boolean | null
  gas_deposit?: number | null
  gas_done?: boolean | null

  // 行政
  tenshutsu_date?: string | null
  tenshutsu_done?: boolean | null
  tennyu_date?: string | null
  tennyu_done?: boolean | null
  tenkyo_date?: string | null
  tenkyo_done?: boolean | null

  // Move state
  is_archived?: boolean | null

  created_at?: string | null
  updated_at?: string | null
}

export async function getWorkerLocations(workerId: string): Promise<WorkerLocation[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("worker_locations")
    .select("*")
    .eq("worker_id", workerId)
    .order("move_number")
  return (data ?? []) as WorkerLocation[]
}

export async function getAllWorkerLocations(): Promise<WorkerLocation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { data } = await supabase
    .from("worker_locations")
    .select("*")
    .eq("team_id", teamId)
    .order("move_number")
  return (data ?? []) as WorkerLocation[]
}

export async function upsertWorkerLocation(
  loc: Omit<WorkerLocation, "id" | "created_at" | "updated_at">
): Promise<{ error: string } | { success: true; id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const { data, error } = await supabase
    .from("worker_locations")
    .upsert({ ...loc, team_id: teamId }, { onConflict: "worker_id,move_number" })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { success: true, id: data.id }
}

export async function deleteWorkerLocation(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("worker_locations").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

// Snapshot the current worker fields as a new location entry
export async function snapshotWorkerAsLocation(
  workerId: string,
  moveNumber: number,
  worker: {
    housing_address?: string | null
    housing_postal_code?: string | null
    housing_building?: string | null
    housing_room?: string | null
    housing_passcode?: string | null
    rent?: number | null
    move_in_date?: string | null
    store_code?: string | null
    store_name?: string | null
    store_address?: string | null
    store_postal_code?: string | null
    store_phone?: string | null
    commute_method?: string | null
    commute_distance?: string | null
    commute_route_url?: string | null
    mobile_phone?: string | null
    electricity_date?: string | null
    water_date?: string | null
    gas_appointment?: string | null
    leopalace_url?: string | null
  }
): Promise<{ error: string } | { success: true; id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  return upsertWorkerLocation({
    worker_id: workerId,
    team_id: teamId,
    move_number: moveNumber,
    ...worker,
  })
}

// Fetch a Leopalace (or similar) property page server-side and extract a phone
// number. Runs on the server to avoid CORS. Display-only — nothing is stored.
export async function fetchLeopalacePhone(
  url: string
): Promise<{ phone: string } | { error: string }> {
  const trimmed = (url ?? "").trim()
  if (!/^https?:\/\//i.test(trimmed)) return { error: "URLが正しくありません。" }

  try {
    const res = await fetch(trimmed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TimIndoBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { error: `取得失敗 (HTTP ${res.status})` }
    const html = await res.text()

    // Japanese landline/mobile: 0X-XXXX-XXXX / 0XX-XXX-XXXX etc.
    const match = html.match(/0\d{1,4}[-(]\d{1,4}[-)]\d{3,4}/)
    if (!match) return { error: "電話番号が見つかりません。" }
    return { phone: match[0].replace(/[()]/g, "-").replace(/-+/g, "-") }
  } catch {
    return { error: "取得失敗" }
  }
}

// ─── 送り込みスケジュール CSV import ──────────────────────────────────────────

export type ParsedMoveRow = {
  employee_no: string
  name: string
  store_code: string
  ido_group: string
  move_in_date: string
  first_work_date: string
  housing_postal_code: string
  housing_address: string
  housing_building: string
  housing_room: string
  housing_passcode: string
  leopalace_url: string
  commute_distance: string
  rent: number | null
  gas_deposit: string
  gas_tachiai_datetime: string
  electricity_start_date: string
  water_start_date: string
  // matching result, filled in server-side
  matched_worker_id: string | null
  matched_worker_name: string | null
  match_confidence: "exact" | "name_only" | "unmatched"
  // current worker values for diff preview
  current_store_code: string | null
  current_arrival_group: string | null
  current_move_in_date: string | null
  current_first_work_date: string | null
  current_housing_postal_code: string | null
  current_housing_address: string | null
  current_housing_building: string | null
  current_housing_room: string | null
  current_housing_passcode: string | null
  current_leopalace_url: string | null
  current_commute_distance: string | null
  current_rent: number | null
}

// Quote-aware CSV parser (handles embedded commas / newlines / "" escapes).
function parseCsv(text: string): string[][] {
  const s = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ",") { row.push(field); field = "" }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
      else field += c
    }
  }
  row.push(field)
  rows.push(row)
  return rows
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase()
const stripSpaces = (s: string | undefined) => (s ?? "").replace(/[\s　]/g, "")

// Find the index of the nth header cell whose text contains `needle`.
function findCol(header: string[], needle: string, occurrence = 1): number {
  const n = norm(needle)
  let count = 0
  for (let i = 0; i < header.length; i++) {
    if (norm(header[i]).includes(n)) { count++; if (count === occurrence) return i }
  }
  return -1
}

function normalizeDate(s: string): string | null {
  const t = (s ?? "").trim()
  const m = t.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
}

// Header keywords that must never appear in a real 配属者名 (catches merged /
// continuation header rows that Excel leaves behind).
const HEADER_TOKENS = ["郵便番号", "部屋番号", "配属者", "従業員", "国籍", "店舗", "住所"]

// Locate the header row by content, not position — the number of junk /
// instruction rows above it varies month to month. A real header row contains
// several of these signature labels.
function findHeaderRow(grid: string[][]): number {
  const signature = ["配属者名", "国籍", "店舗CD", "従業員番号", "社宅住所"]
  for (let i = 0; i < grid.length; i++) {
    const cells = grid[i].map(norm)
    const hits = signature.filter(sig => cells.some(c => c.includes(norm(sig)))).length
    if (hits >= 3) return i
  }
  return -1
}

export async function parseOkurikomiCsv(csvText: string): Promise<ParsedMoveRow[]> {
  const grid = parseCsv(csvText)
  const headerIdx = findHeaderRow(grid)
  if (headerIdx === -1) return []

  const header = grid[headerIdx] // detected header row
  const col = {
    employee_no: findCol(header, "従業員番号"),
    name: findCol(header, "配属者名"),
    nationality: findCol(header, "国籍"),
    store_code: findCol(header, "店舗CD"),
    ido_group: findCol(header, "入国グループ"),
    move_in_date: findCol(header, "入居日"),
    first_work_date: findCol(header, "入社日") !== -1 ? findCol(header, "入社日") : findCol(header, "初出社日"),
    housing_postal_code: findCol(header, "郵便番号", 2), // 1st = store's, 2nd = housing
    housing_address: findCol(header, "社宅住所"),
    housing_building: findCol(header, "物件名"),
    housing_room: findCol(header, "部屋番号"),
    housing_passcode: findCol(header, "パスコード"),
    leopalace_url: findCol(header, "入居ガイド"),
    commute_distance: findCol(header, "通勤距離"),
    rent: findCol(header, "家賃"),
    gas_deposit: findCol(header, "ガス保証金"),
    gas_tachiai_datetime: findCol(header, "ガス立会時間"),
    electricity_start_date: findCol(header, "電気"),
    water_start_date: findCol(header, "水道"),
  }

  const cell = (row: string[], idx: number) => (idx >= 0 ? (row[idx] ?? "").trim() : "")

  type RawRow = Omit<ParsedMoveRow, "matched_worker_id" | "matched_worker_name" | "match_confidence" | "current_store_code" | "current_arrival_group" | "current_move_in_date" | "current_first_work_date" | "current_housing_postal_code" | "current_housing_address" | "current_housing_building" | "current_housing_room" | "current_housing_passcode" | "current_leopalace_url" | "current_commute_distance" | "current_rent">
  const parsed: RawRow[] = []
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const row = grid[r]
    if (!row || row.every(c => !c || !c.trim())) continue // entirely empty

    const nationality = cell(row, col.nationality)
    if (!nationality.includes("インドネシア")) continue // drop Myanmar / others

    const name = cell(row, col.name)
    if (!name) continue
    if (HEADER_TOKENS.some(tok => name.includes(tok))) continue // continuation header row

    const rentStr = cell(row, col.rent).replace(/[^0-9]/g, "")
    parsed.push({
      employee_no: cell(row, col.employee_no),
      name,
      store_code: cell(row, col.store_code),
      ido_group: cell(row, col.ido_group),
      move_in_date: cell(row, col.move_in_date),
      first_work_date: cell(row, col.first_work_date),
      housing_postal_code: cell(row, col.housing_postal_code),
      housing_address: cell(row, col.housing_address),
      housing_building: cell(row, col.housing_building),
      housing_room: cell(row, col.housing_room),
      housing_passcode: cell(row, col.housing_passcode),
      leopalace_url: cell(row, col.leopalace_url),
      commute_distance: cell(row, col.commute_distance),
      rent: rentStr ? parseInt(rentStr) : null,
      gas_deposit: cell(row, col.gas_deposit),
      gas_tachiai_datetime: cell(row, col.gas_tachiai_datetime),
      electricity_start_date: cell(row, col.electricity_start_date),
      water_start_date: cell(row, col.water_start_date),
    })
  }

  // Match against existing workers (server-side).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const teamId: string = user?.user_metadata?.team_id ?? TEAM_ID
  const { data: workers } = await supabase
    .from("workers")
    .select("id, employee_no, name_kana, store_code, arrival_group, move_in_date, first_work_date, housing_postal_code, housing_address, housing_building, housing_room, housing_passcode, leopalace_url, commute_distance, rent")
    .eq("team_id", teamId)

  type WRow = {
    id: string; name_kana: string | null; employee_no?: string | null
    store_code: string | null; arrival_group: string | null
    move_in_date: string | null; first_work_date: string | null
    housing_postal_code: string | null; housing_address: string | null
    housing_building: string | null; housing_room: string | null
    housing_passcode: string | null; leopalace_url: string | null
    commute_distance: string | null; rent: number | null
  }

  const byEmp = new Map<string, WRow>()
  const byName = new Map<string, WRow>()
  for (const w of (workers ?? []) as WRow[]) {
    if (w.employee_no) byEmp.set(norm(w.employee_no), w)
    if (w.name_kana) byName.set(stripSpaces(w.name_kana), w)
  }

  return parsed.map(p => {
    let matched_worker_id: string | null = null
    let matched_worker_name: string | null = null
    let match_confidence: ParsedMoveRow["match_confidence"] = "unmatched"
    let hit: WRow | null = null

    const byEmpHit = p.employee_no ? byEmp.get(norm(p.employee_no)) : undefined
    if (byEmpHit) {
      matched_worker_id = byEmpHit.id; matched_worker_name = byEmpHit.name_kana
      match_confidence = "exact"; hit = byEmpHit
    } else {
      const byNameHit = byName.get(stripSpaces(p.name))
      if (byNameHit) {
        matched_worker_id = byNameHit.id; matched_worker_name = byNameHit.name_kana
        match_confidence = "name_only"; hit = byNameHit
      }
    }
    return {
      ...p, matched_worker_id, matched_worker_name, match_confidence,
      current_store_code: hit?.store_code ?? null,
      current_arrival_group: hit?.arrival_group ?? null,
      current_move_in_date: hit?.move_in_date ?? null,
      current_first_work_date: hit?.first_work_date ?? null,
      current_housing_postal_code: hit?.housing_postal_code ?? null,
      current_housing_address: hit?.housing_address ?? null,
      current_housing_building: hit?.housing_building ?? null,
      current_housing_room: hit?.housing_room ?? null,
      current_housing_passcode: hit?.housing_passcode ?? null,
      current_leopalace_url: hit?.leopalace_url ?? null,
      current_commute_distance: hit?.commute_distance ?? null,
      current_rent: hit?.rent ?? null,
    }
  })
}

export async function applyParsedMoveRows(
  rows: ParsedMoveRow[]
): Promise<{ created: number; skipped: number; errors: string[]; created_ids: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { created: 0, skipped: 0, errors: ["Not logged in."], created_ids: [] }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const errors: string[] = []
  const created_ids: string[] = []
  let created = 0
  let skipped = 0

  const workerIds = [...new Set(rows.filter(r => r.matched_worker_id).map(r => r.matched_worker_id!))]
  const existingByWorker = new Map<string, { max: number; active: boolean }>()
  if (workerIds.length > 0) {
    const { data: existing } = await supabase
      .from("worker_locations")
      .select("worker_id, move_number, is_archived")
      .in("worker_id", workerIds)
    for (const e of existing ?? []) {
      const cur = existingByWorker.get(e.worker_id) ?? { max: 0, active: false }
      existingByWorker.set(e.worker_id, {
        max: Math.max(cur.max, e.move_number ?? 0),
        active: cur.active || !e.is_archived,
      })
    }
  }

  for (const r of rows) {
    if (!r.matched_worker_id) { skipped++; continue }
    const info = existingByWorker.get(r.matched_worker_id) ?? { max: 0, active: false }
    if (info.active) { skipped++; continue }

    const moveNumber = info.max + 1
    const { data: inserted, error } = await supabase.from("worker_locations").insert({
      worker_id: r.matched_worker_id,
      team_id: teamId,
      move_number: moveNumber,
      ido_group: r.ido_group || null,
      first_work_date: normalizeDate(r.first_work_date),
      move_in_date: normalizeDate(r.move_in_date),
      store_code: r.store_code || null,
      housing_postal_code: r.housing_postal_code || null,
      housing_address: r.housing_address || null,
      housing_building: r.housing_building || null,
      housing_room: r.housing_room || null,
      housing_passcode: r.housing_passcode || null,
      leopalace_url: r.leopalace_url || null,
      commute_distance: r.commute_distance || null,
      rent: r.rent,
      gas_deposit: r.gas_deposit ? parseInt(r.gas_deposit.replace(/[^0-9]/g, "")) || null : null,
      gas_tachiai_datetime: r.gas_tachiai_datetime || null,
      electricity_start_date: r.electricity_start_date || null,
      water_start_date: r.water_start_date || null,
      gas_tachiai_unnecessary: false,
      luggage_received: false,
      electricity_done: false,
      water_done: false,
      gas_done: false,
      tenshutsu_done: false,
      tennyu_done: false,
      tenkyo_done: false,
      is_archived: false,
    }).select("id").single()
    if (error) { errors.push(`${r.name}: ${error.message}`); continue }
    created_ids.push(inserted.id)
    created++
    existingByWorker.set(r.matched_worker_id, { max: moveNumber, active: true })
  }

  return { created, skipped, errors, created_ids }
}

// Fields the CSV can update on the workers table, and how they map.
export const CSV_WORKER_FIELD_MAP = [
  { workerKey: "store_code",          csvKey: "store_code",          currentKey: "current_store_code",          label: "店舗CD",    isDate: false },
  { workerKey: "arrival_group",       csvKey: "ido_group",           currentKey: "current_arrival_group",       label: "入国G",      isDate: false },
  { workerKey: "move_in_date",        csvKey: "move_in_date",        currentKey: "current_move_in_date",        label: "入居日",     isDate: true  },
  { workerKey: "first_work_date",     csvKey: "first_work_date",     currentKey: "current_first_work_date",     label: "初出勤",     isDate: true  },
  { workerKey: "housing_postal_code", csvKey: "housing_postal_code", currentKey: "current_housing_postal_code", label: "郵便番号",   isDate: false },
  { workerKey: "housing_address",     csvKey: "housing_address",     currentKey: "current_housing_address",     label: "住所",       isDate: false },
  { workerKey: "housing_building",    csvKey: "housing_building",    currentKey: "current_housing_building",    label: "物件名",     isDate: false },
  { workerKey: "housing_room",        csvKey: "housing_room",        currentKey: "current_housing_room",        label: "部屋番号",   isDate: false },
  { workerKey: "housing_passcode",    csvKey: "housing_passcode",    currentKey: "current_housing_passcode",    label: "パスコード", isDate: false },
  { workerKey: "leopalace_url",       csvKey: "leopalace_url",       currentKey: "current_leopalace_url",       label: "入居URL",    isDate: false },
  { workerKey: "commute_distance",    csvKey: "commute_distance",    currentKey: "current_commute_distance",    label: "通勤距離",   isDate: false },
  { workerKey: "rent",                csvKey: "rent",                currentKey: "current_rent",                label: "家賃",       isDate: false },
] as const

export type WorkerFieldKey = typeof CSV_WORKER_FIELD_MAP[number]["workerKey"]

export async function applyWorkerFieldsFromCsv(
  rows: ParsedMoveRow[],
  selectedFields: WorkerFieldKey[],
  overwriteExisting: boolean
): Promise<{ updated: number; errors: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { updated: 0, errors: ["Not logged in."] }

  const errors: string[] = []
  let updated = 0

  for (const r of rows) {
    if (!r.matched_worker_id) continue
    const patch: Record<string, unknown> = {}

    for (const f of CSV_WORKER_FIELD_MAP) {
      if (!selectedFields.includes(f.workerKey)) continue
      const csvVal = f.csvKey === "rent" ? r.rent : r[f.csvKey as keyof ParsedMoveRow]
      const curVal = r[f.currentKey as keyof ParsedMoveRow]
      const hasCSV = csvVal !== null && csvVal !== undefined && csvVal !== ""
      const hasCur = curVal !== null && curVal !== undefined && curVal !== ""
      if (!hasCSV) continue
      if (hasCur && !overwriteExisting) continue
      patch[f.workerKey] = f.isDate ? (normalizeDate(String(csvVal)) ?? csvVal) : csvVal
    }

    if (Object.keys(patch).length === 0) continue
    const { error } = await supabase.from("workers").update(patch).eq("id", r.matched_worker_id)
    if (error) { errors.push(`${r.name}: ${error.message}`); continue }
    updated++
  }

  return { updated, errors }
}

export async function undoMoveImport(ids: string[]): Promise<{ deleted: number; error?: string }> {
  if (ids.length === 0) return { deleted: 0 }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { deleted: 0, error: "Not logged in." }
  const { error, count } = await supabase
    .from("worker_locations")
    .delete({ count: "exact" })
    .in("id", ids)
  if (error) return { deleted: 0, error: error.message }
  return { deleted: count ?? ids.length }
}
