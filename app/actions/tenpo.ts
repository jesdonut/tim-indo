"use server"

import { createClient } from "@/lib/supabase/server"

export type TenpoStore = {
  tenpo_cd: string
  tenpo_name: string | null
  zip: string | null
  prefecture: string | null
  address: string | null
  tel: string | null
  area_cd: string | null
  am: string | null
}

const COLS = "tenpo_cd, tenpo_name, zip, prefecture, address, tel, area_cd, am"

export async function getTenpoStores(): Promise<TenpoStore[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("tenpo_master")
    .select(COLS)
    .order("tenpo_cd")
  return (data ?? []) as unknown as TenpoStore[]
}

export async function addTenpoStore(
  store: TenpoStore
): Promise<{ error: string } | { success: true }> {
  const code = (store.tenpo_cd ?? "").trim()
  if (!code) return { error: "店舗CDを入力してください。" }
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("tenpo_master")
    .select("tenpo_cd")
    .eq("tenpo_cd", code)
    .maybeSingle()
  if (existing) return { error: `店舗CD「${code}」は既に登録されています。` }

  const { error } = await supabase.from("tenpo_master").insert({ ...store, tenpo_cd: code })
  if (error) return { error: error.message }
  return { success: true }
}

// Update non-key fields of an existing store. tenpo_cd is the identity and is
// not editable here.
export async function updateTenpoStore(
  tenpo_cd: string,
  fields: Partial<Omit<TenpoStore, "tenpo_cd">>
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("tenpo_master").update(fields).eq("tenpo_cd", tenpo_cd)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteTenpoStore(
  tenpo_cd: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("tenpo_master").delete().eq("tenpo_cd", tenpo_cd)
  if (error) return { error: error.message }
  return { success: true }
}
