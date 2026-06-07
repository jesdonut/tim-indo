"use server"

import { createClient } from "@/lib/supabase/server"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

export type Worker = {
  id: string
  worker_id?: string | null
  employee_no?: string | null
  name_kana?: string | null
  nickname?: string | null
  name_latin?: string | null
  gender?: string | null
  nationality?: string | null
  birth_date?: string | null
  mobile_phone?: string | null
  whatsapp?: string | null
  email?: string | null
  assignment_month?: string | null
  batch_period?: string | null
  first_work_date?: string | null
  move_in_date?: string | null
  business_unit?: string | null
  division_name?: string | null
  support_staff?: string | null
  store_code?: string | null
  store_name?: string | null
  store_postal_code?: string | null
  store_address?: string | null
  store_phone?: string | null
  housing_postal_code?: string | null
  housing_address?: string | null
  housing_building?: string | null
  housing_room?: string | null
  housing_passcode?: string | null
  rent?: number | null
  commute_distance?: string | null
  commute_route_url?: string | null
  commute_method?: string | null
  departure_date?: string | null
  japan_arrival_date?: string | null
  arrival_airport?: string | null
  flight_number?: string | null
  arrival_time?: string | null
  arrival_group?: string | null
  electricity_date?: string | null
  water_date?: string | null
  gas_appointment?: string | null
  gas_deposit?: string | null
  leopalace_url?: string | null
  payroll_pre_id?: string | null
  payroll_post_id?: string | null
  payroll_password?: string | null
  status?: string | null
  signal_status?: string | null
  mynumber_status?: string | null
  pledge_done?: boolean | null
  linkus_updated_at?: string | null
  area?: string | null
  notes?: string | null
  team_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export async function getWorkers(): Promise<Worker[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { data } = await supabase
    .from("workers")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at")
  return (data ?? []) as Worker[]
}

// Fields that are preserved if the incoming value is empty — so multiple CSV sources
// can each fill in their part without blanking out what another source already set.
const TRACKING_FIELDS = new Set([
  "status", "signal_status", "mynumber_status", "pledge_done",
  "linkus_updated_at", "area", "notes", "worker_id", "name_latin", "whatsapp",
  "payroll_password", "payroll_pre_id", "payroll_post_id",
  "leopalace_url", "commute_route_url",
])

// Normalize name for matching: trim, collapse all whitespace (including full-width) to single space
function normName(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/[\s　]+/g, " ")
}

export async function upsertWorkers(
  workers: Omit<Worker, "id" | "created_at" | "updated_at" | "team_id">[],
  { preserveTracking = true }: { preserveTracking?: boolean } = {}
): Promise<{ error: string } | { success: true; count: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  // Fetch ALL existing workers for this team
  const { data: existing } = await supabase
    .from("workers")
    .select("id, worker_id, name_kana, status, signal_status, mynumber_status, pledge_done, linkus_updated_at, area, notes, name_latin, whatsapp")
    .eq("team_id", teamId)

  // Match priority: worker_id (通し番号) → name_latin (romaji) → name_kana
  const byWorkerId = new Map(
    (existing ?? []).filter((e: Record<string, unknown>) => e.worker_id)
      .map((e: Record<string, unknown>) => [String(e.worker_id).trim().toUpperCase(), e])
  )
  const byNameLatin = new Map(
    (existing ?? []).filter((e: Record<string, unknown>) => e.name_latin)
      .map((e: Record<string, unknown>) => [normName(e.name_latin as string).toUpperCase(), e])
  )
  const byNameKana = new Map(
    (existing ?? []).map((e: Record<string, unknown>) => [normName(e.name_kana as string), e])
  )

  const toInsert: Record<string, unknown>[] = []
  const toUpdate: Array<{ id: string; fields: Record<string, unknown> }> = []

  for (const w of workers) {
    const row: Record<string, unknown> = { ...w, team_id: teamId }
    const prev =
      (w.worker_id ? byWorkerId.get(w.worker_id.trim().toUpperCase()) : undefined) ??
      (w.name_latin ? byNameLatin.get(normName(w.name_latin).toUpperCase()) : undefined) ??
      (w.name_kana ? byNameKana.get(normName(w.name_kana)) : undefined)

    if (!prev) {
      toInsert.push(row)
    } else {
      const fields: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        if (k === "team_id") continue
        const incoming = v as string | boolean | null | undefined
        const hasValue = incoming !== null && incoming !== undefined && incoming !== ""
        // Always keep existing value if incoming is empty — never blank out data
        fields[k] = hasValue ? incoming : (prev as Record<string, unknown>)[k]
      }
      toUpdate.push({ id: (prev as Record<string, unknown>).id as string, fields })
    }
  }

  if (toInsert.length) {
    // ignoreDuplicates: safety net in case a worker slipped through the lookup above
    const { error } = await supabase.from("workers").upsert(toInsert, { onConflict: "worker_id,team_id", ignoreDuplicates: true })
    if (error) return { error: error.message }
  }

  for (const { id, fields } of toUpdate) {
    const { error } = await supabase.from("workers").update(fields).eq("id", id)
    if (error) return { error: error.message }
  }

  return { success: true, count: workers.length }
}

export async function updateWorker(
  id: string,
  fields: Partial<Omit<Worker, "id" | "created_at" | "team_id">>
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("workers").update(fields).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteWorker(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("workers").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

// Returns all workers as a CSV string (English headers).
// This file can be re-imported to fully restore the database.
export async function exportWorkersCsv(): Promise<{ error: string } | { csv: string; filename: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at")

  if (error) return { error: error.message }

  const rows = (data ?? []) as Worker[]
  if (rows.length === 0) return { csv: "", filename: "workers_export.csv" }

  const COLS: Array<keyof Worker> = [
    "worker_id", "employee_no", "name_kana", "nickname", "name_latin",
    "gender", "nationality", "birth_date",
    "mobile_phone", "whatsapp", "email",
    "assignment_month", "batch_period", "first_work_date", "move_in_date",
    "business_unit", "division_name", "support_staff",
    "store_code", "store_name", "store_postal_code", "store_address", "store_phone",
    "housing_postal_code", "housing_address", "housing_building", "housing_room",
    "housing_passcode", "rent", "commute_distance", "commute_route_url", "commute_method",
    "departure_date", "japan_arrival_date", "arrival_airport", "flight_number",
    "arrival_time", "arrival_group",
    "electricity_date", "water_date", "gas_appointment", "gas_deposit",
    "payroll_pre_id", "payroll_post_id", "payroll_password",
    "status", "signal_status", "mynumber_status", "pledge_done",
    "linkus_updated_at", "area", "notes",
  ]

  function esc(v: unknown): string {
    if (v === null || v === undefined) return ""
    const s = String(v)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const header = COLS.join(",")
  const body = rows.map(r => COLS.map(c => esc(r[c])).join(",")).join("\n")
  const csv = `${header}\n${body}`
  const date = new Date().toISOString().slice(0, 10)
  return { csv, filename: `workers_export_${date}.csv` }
}
