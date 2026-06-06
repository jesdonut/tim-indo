"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const STORAGE_KEY = "team_notes_v1"
const SUPABASE_CONFIGURED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export type SyncStatus = "idle" | "saving" | "saved" | "error" | "local"

export function useNotes() {
  const [content, setContent]   = useState("")
  const [status, setStatus]     = useState<SyncStatus>(SUPABASE_CONFIGURED ? "idle" : "local")
  const [teamId, setTeamId]     = useState<string | null>(null)
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isEditing  = useRef(false)

  // Get team_id from user metadata
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return
    async function getTeamId() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setTeamId(user?.user_metadata?.team_id ?? null)
    }
    getTeamId()
  }, [])

  // Load notes once we have team_id
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setContent(localStorage.getItem(STORAGE_KEY) ?? "")
      return
    }
    if (!teamId) return
    async function load() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase
          .from("team_notes")
          .select("content")
          .eq("team_id", teamId)
          .maybeSingle()
        if (data?.content != null) setContent(data.content)
      } catch { /* supabase not reachable */ }
    }
    load()
  }, [teamId])

  // Realtime subscription
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !teamId) return
    let cleanup: (() => void) | null = null
    async function subscribe() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const channel = supabase
          .channel("team_notes_realtime")
          .on(
            "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
            { event: "*", schema: "public", table: "team_notes", filter: `team_id=eq.${teamId}` } as object,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (payload: any) => {
              if (isEditing.current) return
              const row = payload.new as { content?: string }
              if (row?.content != null) setContent(row.content)
            }
          )
          .subscribe()
        cleanup = () => supabase.removeChannel(channel)
      } catch { /* ignore */ }
    }
    subscribe()
    return () => { cleanup?.() }
  }, [teamId])

  const updateContent = useCallback((val: string) => {
    setContent(val)

    if (!SUPABASE_CONFIGURED) {
      localStorage.setItem(STORAGE_KEY, val)
      return
    }

    isEditing.current = true
    setStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const tid = user?.user_metadata?.team_id
        if (!tid) return
        await supabase.from("team_notes").upsert({
          team_id: tid,
          content: val,
          updated_at: new Date().toISOString(),
        }, { onConflict: "team_id" })
        setStatus("saved")
        setTimeout(() => setStatus("idle"), 2000)
      } catch {
        setStatus("error")
      } finally {
        isEditing.current = false
      }
    }, 800)
  }, [])

  return { content, updateContent, status, isRemote: SUPABASE_CONFIGURED }
}
