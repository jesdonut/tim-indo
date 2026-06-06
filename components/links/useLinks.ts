"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const STORAGE_KEY = "team_links_v1"
const SUPABASE_CONFIGURED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export type TeamLink = {
  id: string
  title: string
  url: string
  category: string
  added_by: string | null
  created_at: string
  pinned?: boolean
}

export function useLinks() {
  const [links, setLinks]     = useState<TeamLink[]>([])
  const [loading, setLoading] = useState(true)

  // Load
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      const stored = localStorage.getItem(STORAGE_KEY)
      setLinks(stored ? JSON.parse(stored) : [])
      setLoading(false)
      return
    }
    async function load() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data } = await supabase
          .from("team_links")
          .select("*")
          .order("created_at", { ascending: true })
        setLinks(data ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Realtime
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return
    let cleanup: (() => void) | null = null
    async function subscribe() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const channel = supabase
        .channel("team_links_realtime")
        .on(
          "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
          { event: "*", schema: "public", table: "team_links" } as object,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            if (payload.eventType === "INSERT") {
              setLinks(prev => [...prev, payload.new as TeamLink])
            } else if (payload.eventType === "DELETE") {
              setLinks(prev => prev.filter(l => l.id !== payload.old.id))
            }
          }
        )
        .subscribe()
      cleanup = () => supabase.removeChannel(channel)
    }
    subscribe()
    return () => { cleanup?.() }
  }, [])

  const addLink = useCallback(async (title: string, url: string, category: string, addedBy: string) => {
    if (!SUPABASE_CONFIGURED) {
      const newLink: TeamLink = {
        id: `local_${Date.now()}`,
        title, url, category,
        added_by: addedBy,
        created_at: new Date().toISOString(),
      }
      setLinks(prev => {
        const next = [...prev, newLink]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
      return
    }
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const teamId = user?.user_metadata?.team_id
    await supabase.from("team_links").insert({ title, url, category, added_by: addedBy, team_id: teamId })
  }, [])

  const removeLink = useCallback(async (id: string) => {
    if (!SUPABASE_CONFIGURED) {
      setLinks(prev => {
        const next = prev.filter(l => l.id !== id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
      return
    }
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("team_links").delete().eq("id", id)
  }, [])

  return { links, loading, addLink, removeLink, isRemote: SUPABASE_CONFIGURED }
}
