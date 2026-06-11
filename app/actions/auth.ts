"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(_: unknown, formData: FormData) {
  const email      = formData.get("email") as string
  const password   = formData.get("password") as string
  const name       = formData.get("name") as string
  const inviteCode = formData.get("inviteCode") as string

  if (inviteCode !== process.env.INVITE_CODE) {
    return { error: "Wrong invite code. Ask Jessica." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, invite_code: inviteCode },
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

export async function updateProfile(_: unknown, formData: FormData) {
  const name   = formData.get("name")   as string
  const nameJa = formData.get("nameJa") as string
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.updateUser({ data: { name, nameJa } })
  if (authErr) return { error: authErr.message }
  if (user) {
    await supabase.from("profiles").update({ name, name_ja: nameJa || null }).eq("id", user.id)
  }
  return { success: true as const }
}
