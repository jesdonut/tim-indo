"use server"

import { createClient } from "@/lib/supabase/server"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

export type Municipality = {
  id: string
  name: string
  name_romaji: string | null
  email: string | null
  submission_method: "email" | "form" | "mail" | null
  form_url: string | null
  status: "pending" | "sent" | "confirmed"
  sent_at: string | null
}

const COLS = "id, name, name_romaji, email, submission_method, form_url, status, sent_at"

async function getTeamId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.user_metadata?.team_id as string | undefined) ?? TEAM_ID
}

export async function getMunicipalities(): Promise<Municipality[]> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const { data } = await supabase
    .from("municipalities")
    .select(COLS)
    .eq("team_id", teamId)
    .order("name")
  return (data ?? []) as Municipality[]
}

export async function addMunicipality(
  m: Omit<Municipality, "id" | "sent_at">
): Promise<{ error: string } | { success: true; id: string }> {
  const name = m.name.trim()
  if (!name) return { error: "自治体名を入力してください。" }
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const { data, error } = await supabase
    .from("municipalities")
    .insert({ ...m, name, team_id: teamId, sent_at: null })
    .select("id")
    .single()
  if (error) return { error: error.message }
  return { success: true, id: (data as { id: string }).id }
}

export async function updateMunicipalityStatus(
  id: string,
  status: Municipality["status"]
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const update: Record<string, unknown> = { status }
  if (status === "sent") update.sent_at = new Date().toISOString()
  const { error } = await supabase
    .from("municipalities")
    .update(update)
    .eq("id", id)
    .eq("team_id", teamId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateMunicipality(
  id: string,
  fields: Partial<Omit<Municipality, "id" | "status" | "sent_at">>
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const { error } = await supabase
    .from("municipalities")
    .update(fields)
    .eq("id", id)
    .eq("team_id", teamId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteMunicipality(
  id: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const { error } = await supabase
    .from("municipalities")
    .delete()
    .eq("id", id)
    .eq("team_id", teamId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function bulkUpsertMunicipalities(
  rows: Omit<Municipality, "id" | "sent_at">[]
): Promise<{ added: number; updated: number; errors: string[] }> {
  const supabase = await createClient()
  const teamId = await getTeamId(supabase)
  const errors: string[] = []

  const clean = rows.filter(r => r.name.trim())
  if (clean.length === 0) return { added: 0, updated: 0, errors: ["有効な行がありません。"] }

  const names = [...new Set(clean.map(r => r.name.trim()))]
  const { data: existing } = await supabase
    .from("municipalities")
    .select("id, name")
    .eq("team_id", teamId)
    .in("name", names)
  const existingMap = new Map(
    (existing ?? []).map(r => [(r as { id: string; name: string }).name, (r as { id: string; name: string }).id])
  )

  const toInsert = clean.filter(r => !existingMap.has(r.name.trim()))
  const toUpdate = clean.filter(r => existingMap.has(r.name.trim()))

  let added = 0
  let updated = 0

  if (toInsert.length) {
    const { error } = await supabase.from("municipalities").insert(
      toInsert.map(r => ({ ...r, name: r.name.trim(), team_id: teamId, sent_at: null }))
    )
    if (error) errors.push(`追加エラー: ${error.message}`)
    else added = toInsert.length
  }

  for (const r of toUpdate) {
    const id = existingMap.get(r.name.trim())!
    const fields: Record<string, unknown> = {}
    if (r.name_romaji) fields.name_romaji = r.name_romaji
    if (r.email) fields.email = r.email
    if (r.submission_method) fields.submission_method = r.submission_method
    if (r.form_url) fields.form_url = r.form_url
    if (Object.keys(fields).length === 0) continue
    const { error } = await supabase
      .from("municipalities")
      .update(fields)
      .eq("id", id)
      .eq("team_id", teamId)
    if (error) errors.push(`${r.name}: ${error.message}`)
    else updated++
  }

  return { added, updated, errors }
}
