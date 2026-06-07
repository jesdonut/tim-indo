"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  })
}

function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (!pathname) return
    const url = window.origin + pathname + (searchParams.toString() ? "?" + searchParams.toString() : "")
    ph.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams, ph])

  return null
}

function UserIdentifier() {
  const ph = usePostHog()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        ph.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.full_name ?? user.email,
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        ph.identify(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name ?? session.user.email,
        })
      } else {
        ph.reset()
      }
    })

    return () => subscription.unsubscribe()
  }, [ph])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <UserIdentifier />
      {children}
    </PHProvider>
  )
}
