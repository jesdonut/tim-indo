"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(_: unknown, formData: FormData) {
  const email      = formData.get("email") as string
  const password   = formData.get("password") as string
  const name       = formData.get("name") as string
  const inviteCode = formData.get("inviteCode") as string

  // Validate invite code server-side (never exposed to client)
  if (inviteCode !== process.env.INVITE_CODE) {
    return { error: "Invalid invite code. Ask Jessica for the link." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  redirect("/verify")
}

export async function logIn(_: unknown, formData: FormData) {
  const email    = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  redirect("/pdf")
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
