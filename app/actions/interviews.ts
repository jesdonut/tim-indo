"use server"

import { createClient } from "@/lib/supabase/server"

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID!

async function teamId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (user?.user_metadata?.team_id ?? TEAM_ID) as string
}

// ── Questions ────────────────────────────────────────────────────────────────

export type Question = {
  id: string
  text: string
  sort_order: number
  active: boolean
}

export async function getQuestions(): Promise<Question[]> {
  const supabase = await createClient()
  const tid = await teamId()
  const { data } = await supabase
    .from("interview_questions")
    .select("id, text, sort_order, active")
    .eq("team_id", tid)
    .eq("active", true)
    .order("sort_order")
  return (data ?? []) as Question[]
}

export async function saveQuestion(text: string, sort_order?: number): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const tid = await teamId()
  const { data } = await supabase
    .from("interview_questions")
    .insert({ team_id: tid, text, sort_order: sort_order ?? 0 })
    .select("id")
    .single()
  return data
}

export async function deleteQuestion(id: string) {
  const supabase = await createClient()
  await supabase.from("interview_questions").update({ active: false }).eq("id", id)
}

// ── Interviews ───────────────────────────────────────────────────────────────

export type Answer = { question_id: string; answer: boolean | null }

export type FieldSet = {
  response?: string
  discussion?: string
  advice?: string
  next_actions?: string
  notes?: string
  when?: string
  where?: string
  who?: string
  what?: string
  why_how?: string
}

export type InterviewFormData = {
  tencho?: Record<string, FieldSet>
  worker?: Record<string, FieldSet>
}

export type Interview = {
  id: string
  worker_id: string
  milestone: string | null
  scheduled_at: string | null
  conducted_at: string
  conducted_by: string | null
  notes: string | null
  email_draft: string | null
  form_data: InterviewFormData | null
  answers: (Answer & { question_text: string })[]
}

export async function getAllInterviews(): Promise<Interview[]> {
  const supabase = await createClient()
  const tid = await teamId()
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, worker_id, milestone, scheduled_at, conducted_at, conducted_by, notes, email_draft, form_data")
    .eq("team_id", tid)
    .order("conducted_at", { ascending: false })
  if (!interviews?.length) return []

  const ids = interviews.map(i => i.id)
  const { data: answers } = await supabase
    .from("interview_answers")
    .select("interview_id, question_id, answer, interview_questions(text)")
    .in("interview_id", ids)

  return interviews.map(iv => ({
    ...iv,
    answers: (answers ?? [])
      .filter(a => a.interview_id === iv.id)
      .map(a => ({
        question_id: a.question_id,
        answer: a.answer,
        question_text: (a.interview_questions as unknown as { text: string } | null)?.text ?? "",
      })),
  }))
}

export async function getInterviewsForWorker(worker_id: string): Promise<Interview[]> {
  const supabase = await createClient()
  const tid = await teamId()
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, worker_id, milestone, scheduled_at, conducted_at, conducted_by, notes, email_draft, form_data")
    .eq("team_id", tid)
    .eq("worker_id", worker_id)
    .order("conducted_at", { ascending: false })
  if (!interviews?.length) return []

  const ids = interviews.map(i => i.id)
  const { data: answers } = await supabase
    .from("interview_answers")
    .select("interview_id, question_id, answer, interview_questions(text)")
    .in("interview_id", ids)

  return interviews.map(iv => ({
    ...iv,
    answers: (answers ?? [])
      .filter(a => a.interview_id === iv.id)
      .map(a => ({
        question_id: a.question_id,
        answer: a.answer,
        question_text: (a.interview_questions as unknown as { text: string } | null)?.text ?? "",
      })),
  }))
}

export async function checkDoubleBook(scheduled_at: string, excludeId?: string): Promise<string | null> {
  const supabase = await createClient()
  const tid = await teamId()
  // Check within a 30-minute window around the requested time
  const t = new Date(scheduled_at)
  const from = new Date(t.getTime() - 15 * 60000).toISOString()
  const to   = new Date(t.getTime() + 15 * 60000).toISOString()
  let q = supabase.from("interviews")
    .select("worker_id, scheduled_at")
    .eq("team_id", tid)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
  if (excludeId) q = q.neq("id", excludeId)
  const { data } = await q
  if (data?.length) return data[0].worker_id
  return null
}

export async function skipMilestone(worker_id: string, milestone: string): Promise<void> {
  const supabase = await createClient()
  const tid = await teamId()
  await supabase.from("interviews").insert({
    team_id: tid,
    worker_id,
    milestone,
    notes: "スキップ（実施済み）",
    email_draft: "",
    conducted_at: new Date().toISOString(),
  })
}

export async function saveInterview(
  worker_id: string,
  milestone: string | null,
  conducted_by: string | null,
  notes: string,
  email_draft: string,
  answers: Answer[],
  scheduled_at?: string | null,
  form_data?: InterviewFormData | null,
): Promise<string | null> {
  const supabase = await createClient()
  const tid = await teamId()

  const { data: iv } = await supabase
    .from("interviews")
    .insert({ team_id: tid, worker_id, milestone, conducted_by, notes, email_draft, scheduled_at: scheduled_at ?? null, form_data: form_data ?? null })
    .select("id")
    .single()
  if (!iv) return null

  if (answers.length) {
    await supabase.from("interview_answers").insert(
      answers.map(a => ({ interview_id: iv.id, question_id: a.question_id, answer: a.answer }))
    )
  }
  return iv.id
}
