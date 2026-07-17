"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

// Ensures a profiles row exists with team_id set so my_team_id() RLS resolves correctly.
// Users who signed up before the trigger existed may have a missing or null team_id.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureProfile(supabase: any, userId: string, name: string | null) {
  const { data: existing } = await supabase
    .from("profiles").select("id, team_id").eq("id", userId).maybeSingle()

  if (!existing) {
    await supabase.from("profiles").insert({ id: userId, team_id: TEAM_ID, name: name ?? userId })
  } else if (!existing.team_id) {
    await supabase.from("profiles").update({ team_id: TEAM_ID }).eq("id", userId)
  }
}

export async function getTeamData() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  console.log("[getTeamData] user:", user?.id ?? null, "err:", userErr?.message ?? null)
  if (!user) return null

  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  console.log("[getTeamData] teamId:", teamId, "metadata.team_id:", user.user_metadata?.team_id ?? null)
  await ensureProfile(supabase, user.id, user.user_metadata?.name ?? user.email ?? null)

  const [{ data: team, error: teamErr }, { data: profiles, error: profErr }] = await Promise.all([
    supabase.from("teams").select("name, invite_code").eq("id", teamId).maybeSingle(),
    supabase.from("profiles").select("id, name, created_at").eq("team_id", teamId).order("created_at", { ascending: true }),
  ])

  console.log("[getTeamData] team:", team, "teamErr:", teamErr?.message ?? null)
  console.log("[getTeamData] profiles:", profiles?.length ?? 0, "profErr:", profErr?.message ?? null)

  // Fall back to hardcoded values — teams table may not be seeded yet
  const resolvedTeam = team ?? { name: "Tim Indo Serba Bisa", invite_code: process.env.INVITE_CODE ?? "" }

  return { team: resolvedTeam, profiles: profiles ?? [], userId: user.id, teamId }
}

// ─── Area name_ja mappings ────────────────────────────────────────────────────

export async function getAreaNameJa(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { data } = await supabase.from("teams").select("area_name_ja").eq("id", teamId).maybeSingle()
  return (data?.area_name_ja as Record<string, string>) ?? {}
}

export async function setAreaNameJa(profileId: string, nameJa: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { data } = await supabase.from("teams").select("area_name_ja").eq("id", teamId).maybeSingle()
  const current = (data?.area_name_ja as Record<string, string>) ?? {}
  const updated = { ...current, [profileId]: nameJa }
  await supabase.from("teams").update({ area_name_ja: updated }).eq("id", teamId)
}

// ─── Multi-team actions ──────────────────────────────────────────────────────

export type MyTeam = {
  id: string
  name: string
  invite_code: string
  role: "leader" | "member"
  active: boolean
}

export async function getMyTeams(): Promise<MyTeam[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const activeTeamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const { data } = await supabase
    .from("team_memberships")
    .select("team_id, role, teams(id, name, invite_code)")
    .eq("user_id", user.id)

  if (!data?.length) return []

  return data.map((row: any) => ({
    id:          row.teams.id,
    name:        row.teams.name,
    invite_code: row.teams.invite_code,
    role:        row.role,
    active:      row.teams.id === activeTeamId,
  }))
}

export async function createTeam(name: string): Promise<{ error: string } | { success: true; team: MyTeam }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }

  const inviteCode = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({ name: name.trim(), invite_code: inviteCode })
    .select()
    .single()

  if (teamErr || !team) return { error: teamErr?.message ?? "Failed to create team." }

  await supabase.from("team_memberships").insert({ user_id: user.id, team_id: team.id, role: "leader" })

  return {
    success: true,
    team: { id: team.id, name: team.name, invite_code: inviteCode, role: "leader", active: false },
  }
}

export async function switchTeam(teamId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }

  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: user.id, team_id: teamId, name: user.user_metadata?.name ?? user.email,
  })
  if (profileErr) return { error: profileErr.message }

  await supabase.auth.updateUser({ data: { team_id: teamId } })
  return { success: true }
}

export async function updateTeamName(teamId: string, name: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("teams").update({ name: name.trim() }).eq("id", teamId)
  if (error) return { error: error.message }
  return { success: true }
}

// Legacy: join by invite code (checks DB, falls back to env INVITE_CODE for original team)
export async function joinTeam(_: unknown, formData: FormData) {
  const inviteCode = (formData.get("inviteCode") as string ?? "").trim()
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }

  // Look up team by invite code in DB
  const { data: team } = await supabase
    .from("teams").select("id, name").eq("invite_code", inviteCode).maybeSingle()

  // Fallback for original hardcoded invite code
  const resolvedTeam = team ?? (inviteCode === process.env.INVITE_CODE
    ? { id: TEAM_ID, name: "Tim Indo Serba Bisa" }
    : null)

  if (!resolvedTeam) return { error: "Invalid invite code." }

  await supabase.from("profiles").upsert({
    id: user.id, team_id: resolvedTeam.id, name: user.user_metadata?.name ?? user.email,
  })
  await supabase.from("team_memberships").upsert(
    { user_id: user.id, team_id: resolvedTeam.id, role: "member" },
    { onConflict: "user_id,team_id" }
  )
  await supabase.auth.updateUser({ data: { team_id: resolvedTeam.id } })

  redirect("/pdf")
}

export async function addTeam(_: unknown, formData: FormData): Promise<{ error: string } | { success: true; teamName: string }> {
  const inviteCode = (formData.get("inviteCode") as string ?? "").trim()
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }

  const { data: team } = await supabase
    .from("teams").select("id, name").eq("invite_code", inviteCode).maybeSingle()

  const resolvedTeam = team ?? (inviteCode === process.env.INVITE_CODE
    ? { id: TEAM_ID, name: "Tim Indo Serba Bisa" }
    : null)

  if (!resolvedTeam) return { error: "Invalid invite code." }

  await supabase.from("profiles").upsert({
    id: user.id, team_id: resolvedTeam.id, name: user.user_metadata?.name ?? user.email,
  })
  await supabase.from("team_memberships").upsert(
    { user_id: user.id, team_id: resolvedTeam.id, role: "member" },
    { onConflict: "user_id,team_id" }
  )
  await supabase.auth.updateUser({ data: { team_id: resolvedTeam.id } })

  return { success: true, teamName: resolvedTeam.name }
}
