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
