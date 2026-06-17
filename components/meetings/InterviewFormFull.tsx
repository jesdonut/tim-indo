"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import type { Question, Interview, InterviewFormData, FieldSet } from "@/app/actions/interviews"
import { checkDoubleBook } from "@/app/actions/interviews"
import type { Worker } from "@/app/actions/workers"

// ── Config ────────────────────────────────────────────────────────────────────

export const MILESTONE_LABELS: Record<string, string> = {
  "1w": "1週間", "2w": "2週間", "1m": "1ヶ月", "2m": "2ヶ月",
  "3m": "3ヶ月", "6m": "6か月", "9m": "9か月", "1y": "1年", "1y3m": "1年3月",
}

type FieldKey = "response" | "discussion" | "advice" | "next_actions" | "notes" | "when" | "where" | "who" | "what" | "why_how"

const FIELD_LABELS: Record<FieldKey, string> = {
  response:     "本人の反応",
  discussion:   "（大東企業▶店長様）お話した内容",
  advice:       "アドバイス内容",
  next_actions: "次回確認事項",
  notes:        "備考",
  when:         "When（いつ）",
  where:        "Where（どこで）",
  who:          "Who（誰が）",
  what:         "What（何を）",
  why_how:      "Why（なぜ）How（どのように）",
}

const TENCHO_RESPONSE_LABEL = "店長様の反応"

type SectionConfig = {
  key: string
  title: string
  hints?: string[]   // reference/script lines shown above the fields
  fields: FieldKey[]
  isTenchoResponse?: boolean
}

// Legal questions grouped by section header for display
type LegalGroup = { header: string; questions: { id: string; text: string }[] }

export const LEGAL_SECTION_GROUPS: LegalGroup[] = [
  { header: "業務内容について", questions: [
    { id: "dq-1", text: "仕事内容は変更ないか？" },
    { id: "dq-2", text: "仕事場所は変更ないか？" },
  ]},
  { header: "待遇について", questions: [
    { id: "dq-3", text: "お給料は変更ないか？" },
    { id: "dq-4", text: "お休みは取れているか？" },
    { id: "dq-5", text: "家は変わっていないか？" },
  ]},
  { header: "保護について", questions: [
    { id: "dq-6", text: "会社や同僚から暴行・脅迫等の不法行為はないか？" },
  ]},
  { header: "生活について", questions: [
    { id: "dq-7", text: "日常生活でトラブルはないか？" },
    { id: "dq-8", text: "健康状態は問題ないか？" },
  ]},
]

const TENCHO_SECTIONS: SectionConfig[] = [
  {
    key: "initial_meeting",
    title: "初回顔合わせ時",
    hints: [
      "御礼（時間・受入れに関して）",
      "店舗の食事提供方法や提供数を聞く",
      "キッチンスペースの数及び広さ、常時就労人数の確認",
      "①支援機関普段の役割、②定期面談の意義説明",
      "【①支援機関の役割】特定技能1号VISAの簡易説明、生活周りのサポート。行政機関提出書類作成、役所手続きサポート、ご本人の生活・就業相談、一般論による教育",
      "【②定期面談の意義】入管へ雇用状況の報告がメイン。別途ご本人の課題感・良い点を店長様と確認しご本人へフィードバック。人財の成長を促し、活躍できる人財となるように確認させて頂く場にしたい旨お伝え",
    ],
    fields: ["response", "discussion", "next_actions", "notes"],
    isTenchoResponse: true,
  },
  {
    key: "trust_building",
    title: "店長様と信頼関係構築",
    hints: [
      "褒めるポイントを見つけて、言葉にしてお伝えする",
      "例①「私のような外部の人間にも丁寧なご挨拶頂きありがとうございます。従業員の方皆さん明るく活気あり、良い雰囲気が伝わってきますね」",
      "例②「こちらに貼って頂いていつでも目に見えるところに掲示されているんですね。そのお気遣い誠にありがとうございます。ご本人も嬉しいと思います。」",
    ],
    fields: ["response", "discussion", "next_actions", "notes"],
    isTenchoResponse: true,
  },
  {
    key: "worker_challenges",
    title: "ご本人の課題感確認",
    hints: [
      "こちらの現場に配属されて○ヶ月ですが、率直に現場でのご活躍度はいかがでしょうか。",
    ],
    fields: ["response", "discussion", "next_actions", "notes"],
    isTenchoResponse: true,
  },
  {
    key: "good_case",
    title: "良い場合（頑張ってくれている等抽象表現の場合）",
    hints: [
      "①「そのようなご評価ありがとうございます。ちなみに現在どのような業務をメインにされていて業務面のどのあたりをご評価頂いているのか少し細かく聞いても良いでしょうか。」",
      "②「そのようなご評価ありがとうございます。ちなみに取り組む姿勢を褒めて頂いているのでしょうか。最近あったご本人のエピソード教えてください。」",
      "「ご本人に対してもう少し成長して欲しいなというポイントを教えてくれませんか？（日本語会話、理解力、意識等）」※理由も必ず聞く",
    ],
    fields: ["response", "discussion", "next_actions", "notes"],
    isTenchoResponse: true,
  },
  {
    key: "bad_case",
    title: "悪い場合",
    hints: [
      "「ご共有ありがとうございます。ちなみにどのような場面でそう感じるのでしょうか。最近ご指摘頂いた際のエピソードをお聞かせ頂けますでしょうか。」",
      "５W1H（When・Where・Who・What・Why・How）を意識してヒアリング",
      "▶その場で解決策を持ち合わせない場合は持ち帰り、営業チームに報告する",
    ],
    fields: ["when", "where", "who", "what", "why_how", "discussion", "next_actions"],
  },
  {
    key: "compass_case",
    title: "コンパス社の場合",
    hints: ["コンパスナビを使って学習はされておりますか？"],
    fields: ["response"],
    isTenchoResponse: true,
  },
  {
    key: "unclear_points",
    title: "不明点を聞く",
    hints: ["その他ご不明な点等御座いませんか。"],
    fields: ["notes"],
  },
]

type WorkerSectionGroup = {
  group: string
  items: SectionConfig[]
}

const WORKER_SECTION_GROUPS: WorkerSectionGroup[] = [
  {
    group: "業務面",
    items: [
      { key: "career_plan",  title: "キャリア計画",    hints: ["自分のキャリアについてどういう計画を立てていますか？（5年後まで）"], fields: ["response", "advice", "next_actions", "notes"] },
      { key: "work_content", title: "仕事内容",        hints: ["今のお仕事内容を詳しく教えてください。（1日のスケジュールを聞く）"], fields: ["response", "next_actions", "notes"] },
      { key: "new_skills",   title: "新しくできた仕事", hints: ["３ヶ月前と比べて新しく出来るようになったお仕事を教えてください。"],  fields: ["response", "advice", "next_actions", "notes"] },
      { key: "difficulties", title: "難しいこと",       hints: ["仕事において難しいと感じているところは何ですか？"],                 fields: ["response", "advice", "next_actions", "notes"] },
      { key: "improvements", title: "改善・意識",       hints: ["仕事において気を付けているところ、改善しているところは何ですか？"],   fields: ["response", "advice", "next_actions", "notes"] },
    ],
  },
  {
    group: "人間関係（業務面において）",
    items: [
      { key: "lunch_colleagues",       title: "お昼の同僚",      hints: ["お昼休憩でよく話す同僚を教えてください。"],                                          fields: ["response", "advice", "next_actions"] },
      { key: "coworker_conversations", title: "会話・エピソード", hints: ["同僚・先輩・店長とは何の話をよくするのですか？最近のエピソードを教えてください。"], fields: ["response", "advice", "next_actions", "notes"] },
      { key: "learning_mindset",       title: "仕事を教わる時",  hints: ["仕事を教えてもらっている時、気を付けていることは何ですか？"],                       fields: ["response", "advice", "next_actions", "notes"] },
    ],
  },
  {
    group: "私生活面",
    items: [
      { key: "japanese_study", title: "日本語勉強",       hints: ["日本語の勉強は現在どのように進めていますか？"],                               fields: ["response", "advice", "next_actions"] },
      { key: "days_off",       title: "休日の過ごし方",   hints: ["休みの日はどう過ごしていますか？"],                                           fields: ["response", "advice", "next_actions"] },
      { key: "outings",        title: "お出かけ",         hints: ["最近どこか出掛けたりしましたか？"],                                           fields: ["response", "advice", "next_actions", "notes"] },
      { key: "family_contact", title: "母国の家族",       hints: ["母国にいる家族とはどのくらいの頻度で連絡を取っていますか？"],                 fields: ["response", "advice", "next_actions"] },
      { key: "remittance",     title: "送金（ミャンマー）", hints: ["【ミャンマー人の場合】毎月給料の25%ミャンマーの家族に送金していますか？"], fields: ["response", "advice", "next_actions", "notes"] },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

type WorkerAnswers = Record<string, boolean | null>

function emptyFormData(): InterviewFormData {
  return { tencho: {}, worker: {} }
}

function getField(fd: InterviewFormData, area: "tencho" | "worker", key: string, field: FieldKey): string {
  return fd[area]?.[key]?.[field] ?? ""
}

function setField(fd: InterviewFormData, area: "tencho" | "worker", key: string, field: FieldKey, val: string): InterviewFormData {
  return {
    ...fd,
    [area]: {
      ...fd[area],
      [key]: { ...(fd[area]?.[key] ?? {}), [field]: val },
    },
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ label, value, prevValue, onChange, rows = 2 }: {
  label: string
  value: string
  prevValue?: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[0.65rem] text-[var(--text-3)] uppercase tracking-wide">{label}</label>
      {prevValue && (
        <div className="px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border-soft)] text-[0.75rem] text-[var(--text-3)] whitespace-pre-wrap leading-relaxed">
          <span className="text-[0.6rem] uppercase tracking-wider text-[var(--text-3)] opacity-60 mr-1.5">前回</span>
          {prevValue}
        </div>
      )}
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={prevValue ? "今回の内容を入力…" : undefined}
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--text-2)] resize-none transition-colors"
      />
    </div>
  )
}

function SectionCard({ config, area, formData, prevFormData, onChange, isTenchoResp }: {
  config: SectionConfig
  area: "tencho" | "worker"
  formData: InterviewFormData
  prevFormData: InterviewFormData | null
  onChange: (fd: InterviewFormData) => void
  isTenchoResp?: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[var(--bg-2)] hover:bg-[var(--bg)] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[var(--text)]">{config.title}</span>
        <Icon name={open ? "expand_less" : "expand_more"} size={16} />
      </button>

      {open && (
        <div className="px-4 py-3 flex flex-col gap-3">
          {config.hints && config.hints.length > 0 && (
            <div className="bg-[var(--bg-2)] rounded px-3 py-2 flex flex-col gap-1">
              {config.hints.map((h, i) => (
                <p key={i} className="text-[0.73rem] text-[var(--text-2)] italic leading-snug">{h}</p>
              ))}
            </div>
          )}
          {config.fields.map(field => (
            <FieldRow
              key={field}
              label={field === "response" && isTenchoResp ? TENCHO_RESPONSE_LABEL : FIELD_LABELS[field]}
              value={getField(formData, area, config.key, field)}
              prevValue={prevFormData ? getField(prevFormData, area, config.key, field) : undefined}
              onChange={val => onChange(setField(formData, area, config.key, field, val))}
              rows={field === "why_how" || field === "response" ? 3 : 2}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Default questions derived from the grouped structure above
const DEFAULT_QUESTIONS: Question[] = LEGAL_SECTION_GROUPS.flatMap((g, gi) =>
  g.questions.map((q, qi) => ({ id: q.id, text: q.text, sort_order: gi * 10 + qi, active: true }))
)

// ── Main form ─────────────────────────────────────────────────────────────────

type Tab = "legal" | "tencho" | "worker"

export default function InterviewFormFull({ worker, milestone, milestoneLabel, dueDate, questions: dbQuestions, prevInterview, onSave, onClose }: {
  worker: Worker
  milestone: string
  milestoneLabel: string
  dueDate: Date
  questions: Question[]
  prevInterview: Interview | null
  onSave: (args: {
    answers: WorkerAnswers
    notes: string
    emailDraft: string
    scheduledAt: string
    formData: InterviewFormData
  }) => Promise<void>
  onClose: () => void
}) {
  // Merge default questions with any custom DB questions (DB ones appended after)
  const questions = [
    ...DEFAULT_QUESTIONS,
    ...dbQuestions.filter(q => !DEFAULT_QUESTIONS.some(d => d.text === q.text)),
  ]

  const [tab, setTab] = useState<Tab>("legal")
  const [answers, setAnswers] = useState<WorkerAnswers>({})
  const [formData, setFormData] = useState<InterviewFormData>(emptyFormData)
  const prevFormData = prevInterview?.form_data ?? null
  const [notes, setNotes] = useState("")
  const [emailDraft, setEmailDraft] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [doubleBook, setDoubleBook] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const prev = prevInterview
  const hasPrev = !!(prev?.answers.length)

  async function handleScheduleChange(val: string) {
    setScheduledAt(val)
    setDoubleBook(null)
    if (val) {
      const conflict = await checkDoubleBook(new Date(val).toISOString())
      if (conflict) setDoubleBook(conflict)
    }
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ answers, notes, emailDraft, scheduledAt, formData })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 h-12 border-b border-[var(--border)] shrink-0">
        <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
          <Icon name="arrow_back" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[var(--text)] mr-2">
            {worker.name_latin ?? worker.name_kana ?? worker.worker_id}
          </span>
          <span className="text-[0.72rem] text-[var(--text-3)]">
            {milestoneLabel} · {dueDate.toLocaleDateString("ja-JP")}
            {worker.support_staff ? ` · ${worker.support_staff}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-[var(--bg-2)] rounded p-0.5 gap-0.5">
            {(["legal", "tencho", "worker"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1 rounded text-[0.72rem] font-medium transition-all",
                  tab === t ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-2)] hover:text-[var(--text)]"
                )}
              >
                {t === "legal" ? "法律範囲" : t === "tencho" ? "店長様" : "人財"}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.75rem] font-semibold hover:opacity-80 disabled:opacity-50 transition-all"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-4">

          {/* ── Tab: 法律範囲 ── */}
          {tab === "legal" && (
            <>
              <div className="flex flex-col gap-2">
                <p className="label-xs">面談日時</p>
                <input
                  type="datetime-local"
                  className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"
                  value={scheduledAt}
                  onChange={e => handleScheduleChange(e.target.value)}
                />
                {doubleBook && (
                  <p className="text-[0.72rem] text-red-400">⚠ この時間帯は {doubleBook} の面談と重なっています</p>
                )}
              </div>

              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                {hasPrev && (
                  <div className="grid grid-cols-[1fr_80px_80px] gap-3 px-4 py-2 bg-[var(--bg-2)] border-b border-[var(--border)]">
                    <span className="text-[0.65rem] text-[var(--text-3)]">質問</span>
                    <span className="text-[0.65rem] text-[var(--text-3)] text-center">前回</span>
                    <span className="text-[0.65rem] text-[var(--text-3)] text-center">今回</span>
                  </div>
                )}
                {LEGAL_SECTION_GROUPS.map(group => {
                  const groupQs = group.questions.map(gq =>
                    questions.find(q => q.id === gq.id || q.text === gq.text) ?? { ...gq, sort_order: 0, active: true }
                  )
                  return (
                    <div key={group.header} className="divide-y divide-[var(--border-soft)]">
                      <div className="px-4 py-2 bg-[var(--bg-2)] border-y border-[var(--border-soft)]">
                        <span className="text-[0.7rem] font-bold text-[var(--text)]">{group.header}</span>
                      </div>
                      {groupQs.map(q => {
                        const prevAns = hasPrev ? prev!.answers.find(a => a.question_id === q.id)?.answer ?? null : null
                        const curr = answers[q.id] ?? null
                        return (
                          <div key={q.id} className={cn(
                            "px-4 py-3",
                            hasPrev ? "grid grid-cols-[1fr_80px_80px] gap-3 items-center" : "flex items-center justify-between gap-4"
                          )}>
                            <span className="text-sm text-[var(--text)]">{q.text}</span>
                            {hasPrev && (
                              <span className={cn(
                                "text-center text-[0.75rem] font-medium",
                                prevAns === true ? "text-green-500" : prevAns === false ? "text-red-400" : "text-[var(--text-3)]"
                              )}>
                                {prevAns === true ? "有" : prevAns === false ? "無" : "—"}
                              </span>
                            )}
                            <div className="flex gap-1.5 justify-center">
                              <button
                                onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === true ? null : true }))}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                                  curr === true ? "bg-red-400/20 text-red-400 ring-1 ring-red-400/40" : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-red-400"
                                )}
                              >有</button>
                              <button
                                onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === false ? null : false }))}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                                  curr === false ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/40" : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-green-500"
                                )}
                              >無</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {/* Custom DB questions not in default groups */}
                {questions.filter(q => !LEGAL_SECTION_GROUPS.flatMap(g => g.questions).some(gq => gq.id === q.id || gq.text === q.text)).map(q => {
                  const prevAns = hasPrev ? prev!.answers.find(a => a.question_id === q.id)?.answer ?? null : null
                  const curr = answers[q.id] ?? null
                  return (
                    <div key={q.id} className={cn(
                      "px-4 py-3 border-t border-[var(--border-soft)]",
                      hasPrev ? "grid grid-cols-[1fr_80px_80px] gap-3 items-center" : "flex items-center justify-between gap-4"
                    )}>
                      <span className="text-sm text-[var(--text)]">{q.text}</span>
                      {hasPrev && (
                        <span className={cn("text-center text-[0.75rem] font-medium", (prev!.answers.find(a => a.question_id === q.id)?.answer ?? null) === true ? "text-green-500" : "text-[var(--text-3)]")}>
                          {(prev!.answers.find(a => a.question_id === q.id)?.answer ?? null) === true ? "有" : (prev!.answers.find(a => a.question_id === q.id)?.answer ?? null) === false ? "無" : "—"}
                        </span>
                      )}
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === true ? null : true }))} className={cn("px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all", curr === true ? "bg-red-400/20 text-red-400 ring-1 ring-red-400/40" : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-red-400")}>有</button>
                        <button onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === false ? null : false }))} className={cn("px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all", curr === false ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/40" : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-green-500")}>無</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <FieldRow label="備考" value={notes} onChange={setNotes} rows={3} />
              <FieldRow label="メール下書き（店長様へ）" value={emailDraft} onChange={setEmailDraft} rows={5} />
            </>
          )}

          {/* ── Tab: 店長様 ── */}
          {tab === "tencho" && (
            <>
              {prevFormData?.tencho && Object.keys(prevFormData.tencho).length > 0 && (
                <p className="text-[0.72rem] text-[var(--text-3)] bg-[var(--bg-2)] rounded px-3 py-2">
                  前回（{prevInterview?.milestone}）の回答を各フィールドの上に表示しています
                </p>
              )}
              {TENCHO_SECTIONS.map(sec => (
                <SectionCard
                  key={sec.key}
                  config={sec}
                  area="tencho"
                  formData={formData}
                  prevFormData={prevFormData}
                  onChange={setFormData}
                  isTenchoResp={sec.isTenchoResponse}
                />
              ))}
            </>
          )}

          {/* ── Tab: 人財 ── */}
          {tab === "worker" && (
            <>
              {prevFormData?.worker && Object.keys(prevFormData.worker).length > 0 && (
                <p className="text-[0.72rem] text-[var(--text-3)] bg-[var(--bg-2)] rounded px-3 py-2">
                  前回（{prevInterview?.milestone}）の回答を各フィールドの上に表示しています
                </p>
              )}
              {WORKER_SECTION_GROUPS.map(group => (
                <div key={group.group} className="flex flex-col gap-3">
                  <p className="label-xs">{group.group}</p>
                  {group.items.map(sec => (
                    <SectionCard
                      key={sec.key}
                      config={sec}
                      area="worker"
                      formData={formData}
                      prevFormData={prevFormData}
                      onChange={setFormData}
                    />
                  ))}
                </div>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Exports for Excel ─────────────────────────────────────────────────────────

export { TENCHO_SECTIONS, WORKER_SECTION_GROUPS, FIELD_LABELS, TENCHO_RESPONSE_LABEL }
export type { WorkerAnswers, SectionConfig, WorkerSectionGroup }
