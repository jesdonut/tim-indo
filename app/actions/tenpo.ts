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
  gm: string | null
  am: string | null
}

const COLS = "tenpo_cd, tenpo_name, zip, prefecture, address, tel, area_cd, gm, am"

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

// Bulk add/update from a pasted Excel block. New codes are inserted; existing
// codes get their non-empty fields updated (blank cells are left untouched, so
// a partial paste never wipes data).
const EDITABLE_KEYS: (keyof Omit<TenpoStore, "tenpo_cd">)[] =
  ["tenpo_name", "zip", "prefecture", "address", "tel", "area_cd", "gm", "am"]

export async function bulkUpsertTenpoStores(
  rows: TenpoStore[]
): Promise<{ added: number; updated: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  const clean = rows
    .map(r => ({ ...r, tenpo_cd: (r.tenpo_cd ?? "").trim() }))
    .filter(r => r.tenpo_cd)
  if (clean.length === 0) return { added: 0, updated: 0, errors: ["有効な行がありません。"] }

  const codes = [...new Set(clean.map(r => r.tenpo_cd))]
  const { data: existingRows } = await supabase
    .from("tenpo_master")
    .select("tenpo_cd")
    .in("tenpo_cd", codes)
  const existing = new Set((existingRows ?? []).map(r => (r as { tenpo_cd: string }).tenpo_cd))

  const toInsert = clean.filter(r => !existing.has(r.tenpo_cd))
  const toUpdate = clean.filter(r => existing.has(r.tenpo_cd))

  let added = 0
  let updated = 0

  if (toInsert.length) {
    const { error } = await supabase.from("tenpo_master").insert(
      toInsert.map(r => ({
        tenpo_cd: r.tenpo_cd,
        tenpo_name: r.tenpo_name || null,
        zip: r.zip || null,
        prefecture: r.prefecture || null,
        address: r.address || null,
        tel: r.tel || null,
        area_cd: r.area_cd || null,
        gm: r.gm || null,
        am: r.am || null,
      }))
    )
    if (error) errors.push(`追加エラー: ${error.message}`)
    else added = toInsert.length
  }

  for (const r of toUpdate) {
    const fields: Record<string, string> = {}
    for (const k of EDITABLE_KEYS) {
      const v = (r[k] ?? "").trim()
      if (v) fields[k] = v
    }
    if (Object.keys(fields).length === 0) continue
    const { error } = await supabase.from("tenpo_master").update(fields).eq("tenpo_cd", r.tenpo_cd)
    if (error) errors.push(`${r.tenpo_cd}: ${error.message}`)
    else updated++
  }

  return { added, updated, errors }
}
