"use server"

import { createClient } from "@/lib/supabase/server"

export type SubmissionMethod =
  | "メール" | "ホームページフォーム" | "電子申請システム" | "郵送" | "窓口" | "電話" | "未調査"

export type KyoryokuStatus = "未着手" | "調査済" | "提出済" | "受理確認済"

export type Municipality = {
  id: string
  name: string
  submission_method: SubmissionMethod
  email: string | null
  form_url: string | null
  department: string | null
  notes: string | null
}

export type Submission = {
  id: string
  store_code: string | null
  store_name: string | null
  store_address: string | null
  municipality_id: string | null
  status: KyoryokuStatus
  submitted_at: string | null
  receipt_number: string | null
  pdf_generated_at: string | null
}

export async function getKyoryoku(): Promise<
  { municipalities: Municipality[]; submissions: Submission[] } | { error: string }
> {
  const supabase = await createClient()

  const { data: munis, error: mErr } = await supabase
    .from("municipalities")
    .select("id, name, submission_method, email, form_url, department, notes")
    .order("name")
  if (mErr) return { error: mErr.message }

  // page past Supabase's 1000-row cap
  const submissions: Submission[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("kyoryoku_submissions")
      .select("id, store_code, store_name, store_address, municipality_id, status, submitted_at, receipt_number, pdf_generated_at")
      .order("store_name")
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    const rows = (data ?? []) as Submission[]
    submissions.push(...rows)
    if (rows.length < PAGE) break
  }

  return { municipalities: (munis ?? []) as Municipality[], submissions }
}

export async function updateSubmission(
  id: string,
  fields: Partial<Pick<Submission, "status" | "submitted_at" | "receipt_number" | "pdf_generated_at" | "store_name" | "store_address">>
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("kyoryoku_submissions").update(fields).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateMunicipality(
  id: string,
  fields: Partial<Omit<Municipality, "id">>
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { error } = await supabase.from("municipalities").update(fields).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

// Called right after a PDF is generated in the browser.
export async function markPdfGenerated(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: cur } = await supabase
    .from("kyoryoku_submissions").select("status").eq("id", id).maybeSingle()

  const patch: Record<string, unknown> = { pdf_generated_at: new Date().toISOString() }
  // 未着手/調査済 のままなら「調査済」へ進める（提出済/受理確認済 は後退させない）
  if (cur?.status === "未着手") patch.status = "調査済"

  const { error } = await supabase.from("kyoryoku_submissions").update(patch).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}
