"use server"

import { createClient } from "@/lib/supabase/server"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"

export type WorkerTemplate = {
  id: string
  name: string
  content: string
  created_at: string
}

export async function getWorkerTemplates(): Promise<WorkerTemplate[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID
  const { data } = await supabase
    .from("worker_templates")
    .select("id, name, content, created_at")
    .eq("team_id", teamId)
    .order("name")
  return (data ?? []) as WorkerTemplate[]
}

export async function saveWorkerTemplate(
  name: string,
  content: string
): Promise<{ error: string } | { success: true; template: WorkerTemplate }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not logged in." }
  const teamId: string = user.user_metadata?.team_id ?? TEAM_ID

  const { data, error } = await supabase
    .from("worker_templates")
    .upsert(
      { team_id: teamId, name, content, created_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: "team_id,name" }
    )
    .select("id, name, content, created_at")
    .single()

  if (error) return { error: error.message }
  return { success: true, template: data as WorkerTemplate }
}

export async function deleteWorkerTemplate(
  id: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("worker_templates").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}
