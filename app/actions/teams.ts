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

export async function getLinks() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log("[getLinks] user:", user?.id ?? null, "error:", userError?.message ?? null)

  if (!user) return []

  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  await ensureProfile(supabase, user.id, user.user_metadata?.name ?? user.email ?? null)
  console.log("[getLinks] teamId:", teamId)

  const { data, error } = await supabase
    .from("team_links")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })

  console.log("[getLinks] rows:", data?.length ?? 0, "error:", error?.message ?? null)
  return data ?? []
}

export async function addLink(title: string, url: string, category: string, addedBy: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }

  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const { error } = await supabase.from("team_links").insert({
    title, url, category, added_by: addedBy, team_id: teamId,
  })

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function removeLink(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("team_links").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function renameCategory(oldName: string, newName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { error } = await supabase
    .from("team_links")
    .update({ category: newName.trim() })
    .eq("category", oldName)
    .eq("team_id", teamId)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function updateLink(id: string, fields: { title: string; url: string; category: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from("team_links").update(fields).eq("id", id)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function togglePin(id: string, pinned: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from("team_links").update({ pinned }).eq("id", id)
  if (error) return { error: error.message }
  return { success: true as const }
}

// Persist a manual card arrangement. Writes each id's index to sort_order.
// Degrades gracefully if the sort_order column is missing (pre-migration):
// the UI keeps its optimistic order, it just won't survive a reload yet.
export async function reorderLinks(orderedIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from("team_links").update({ sort_order: i }).eq("id", id))
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  return { success: true as const }
}

// ─── Phone scripts ────────────────────────────────────────────────────────────

export type PhoneScript = {
  id: string
  category: string
  label: string
  content: string
  sort_order: number
}

export async function renamePhoneCategory(oldName: string, newName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { error } = await supabase
    .from("phone_scripts")
    .update({ category: newName.trim() })
    .eq("category", oldName)
    .eq("team_id", teamId)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function getPhoneScripts(): Promise<PhoneScript[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  await ensureProfile(supabase, user.id, user.user_metadata?.name ?? user.email ?? null)
  const { data } = await supabase
    .from("phone_scripts")
    .select("id, category, label, content, sort_order")
    .eq("team_id", teamId)
    .order("category").order("sort_order")
  return (data ?? []) as PhoneScript[]
}

export async function savePhoneScript(
  id: string | null,
  category: string,
  label: string,
  content: string,
  sortOrder: number
): Promise<{ error: string } | { success: true; id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  if (id) {
    const { error } = await supabase
      .from("phone_scripts")
      .update({ category: category.trim(), label: label.trim(), content: content.trim(), sort_order: sortOrder })
      .eq("id", id)
    if (error) return { error: error.message }
    return { success: true, id }
  } else {
    const { data, error } = await supabase
      .from("phone_scripts")
      .insert({ team_id: teamId, category: category.trim(), label: label.trim(), content: content.trim(), sort_order: sortOrder })
      .select("id").single()
    if (error || !data) return { error: error?.message ?? "Insert failed." }
    return { success: true, id: data.id }
  }
}

export async function deletePhoneScript(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("phone_scripts").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
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
