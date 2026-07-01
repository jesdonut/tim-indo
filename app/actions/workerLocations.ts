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
