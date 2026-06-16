"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import * as XLSX from "xlsx"
import { getWorkers, type Worker } from "@/app/actions/workers"
import {
  getQuestions, saveQuestion, deleteQuestion,
  getAllInterviews, saveInterview, checkDoubleBook,
  type Question, type Interview, type Answer,
} from "@/app/actions/interviews"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent, PillTabs } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"

// ── Milestones ────────────────────────────────────────────────────────────────

const MILESTONES = [
  { key: "1w",   label: "1週間",  days: 7   },
  { key: "2w",   label: "2週間",  days: 14  },
  { key: "1m",   label: "1ヶ月",  days: 30  },
  { key: "2m",   label: "2ヶ月",  days: 60  },
  { key: "3m",   label: "3ヶ月",  days: 90  },
  { key: "6m",   label: "6か月",  days: 180 },
  { key: "9m",   label: "9か月",  days: 270 },
  { key: "1y",   label: "1年",    days: 365 },
  { key: "1y3m", label: "1年3月", days: 450 },
]

function milestoneDate(startDate: string, days: number): Date {
  const d = new Date(startDate)
  d.setDate(d.getDate() + days)
  return d
}

function daysFromToday(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / 86400000)
}

type MilestoneStatus = "done" | "overdue" | "soon" | "upcoming"

function getMilestoneStatus(dueDate: Date, done: boolean): MilestoneStatus {
  if (done) return "done"
  const d = daysFromToday(dueDate)
  if (d < 0) return "overdue"
  if (d <= 7) return "soon"
  return "upcoming"
}

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkerRow = {
  worker: Worker
  milestone: typeof MILESTONES[number]
  dueDate: Date
  status: MilestoneStatus
  completedInterview: Interview | null
  prevInterview: Interview | null  // previous milestone's interview for comparison
}

type WorkerAnswers = Record<string, boolean | null>

// ── Interview form (slide panel) ──────────────────────────────────────────────

function InterviewForm({ row, questions, onSave, onClose }: {
  row: WorkerRow
  questions: Question[]
  onSave: (answers: WorkerAnswers, notes: string, emailDraft: string, scheduledAt: string) => Promise<void>
  onClose: () => void
}) {
  const [answers, setAnswers] = useState<WorkerAnswers>({})
  const [notes, setNotes] = useState("")
  const [emailDraft, setEmailDraft] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [doubleBook, setDoubleBook] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const prev = row.prevInterview
  const hasPrev = prev && prev.answers.length > 0

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
    await onSave(answers, notes, emailDraft, scheduledAt)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <button className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-base font-bold text-[var(--text)]">
              {row.worker.name_latin ?? row.worker.name_kana}
            </p>
            <p className="text-[0.72rem] text-[var(--text-3)] mt-0.5">
              {row.milestone.label} · 期限 {row.dueDate.toLocaleDateString("ja-JP")}
              {row.worker.support_staff ? ` · ${row.worker.support_staff}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors mt-0.5">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto">
          {questions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--text-3)]">質問がまだ設定されていません。</p>
          ) : (
            <div className="divide-y divide-[var(--border-soft)]">
              {hasPrev && (
                <div className="grid grid-cols-[1fr_80px_80px] gap-3 px-5 py-2 bg-[var(--bg-2)]">
                  <span className="text-[0.65rem] text-[var(--text-3)]">質問</span>
                  <span className="text-[0.65rem] text-[var(--text-3)] text-center">前回</span>
                  <span className="text-[0.65rem] text-[var(--text-3)] text-center">今回</span>
                </div>
              )}
              {questions.map(q => {
                const prevAns = hasPrev
                  ? prev.answers.find(a => a.question_id === q.id)?.answer ?? null
                  : null
                const curr = answers[q.id] ?? null
                return (
                  <div key={q.id} className={cn(
                    "px-5 py-3",
                    hasPrev ? "grid grid-cols-[1fr_80px_80px] gap-3 items-center" : "flex items-center justify-between gap-4"
                  )}>
                    <span className="text-sm text-[var(--text)]">{q.text}</span>
                    {hasPrev && (
                      <span className={cn(
                        "text-center text-[0.75rem] font-medium",
                        prevAns === true ? "text-green-500" : prevAns === false ? "text-red-400" : "text-[var(--text-3)]"
                      )}>
                        {prevAns === true ? "はい" : prevAns === false ? "いいえ" : "—"}
                      </span>
                    )}
                    <div className="flex gap-1.5 justify-center">
                      <button
                        onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === true ? null : true }))}
                        className={cn(
                          "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                          curr === true
                            ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/40"
                            : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-green-500"
                        )}
                      >はい</button>
                      <button
                        onClick={() => setAnswers(a => ({ ...a, [q.id]: curr === false ? null : false }))}
                        className={cn(
                          "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                          curr === false
                            ? "bg-red-400/20 text-red-400 ring-1 ring-red-400/40"
                            : "bg-[var(--bg-2)] text-[var(--text-3)] hover:text-red-400"
                        )}
                      >いいえ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {hasPrev && (
            <div className="px-5 py-2 border-t border-[var(--border-soft)]">
              <p className="text-[0.65rem] text-[var(--text-3)]">
                前回: {new Date(prev.conducted_at).toLocaleDateString("ja-JP")} ({prev.milestone})
                {prev.conducted_by ? ` · ${prev.conducted_by}` : ""}
              </p>
            </div>
          )}

          <div className="px-5 py-4 border-t border-[var(--border)] flex flex-col gap-4">
            {/* Schedule date/time */}
            <div>
              <p className="label-xs mb-2">面談日時を設定</p>
              <input
                type="datetime-local"
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"
                value={scheduledAt}
                onChange={e => handleScheduleChange(e.target.value)}
              />
              {doubleBook && (
                <p className="text-[0.72rem] text-red-400 mt-1">
                  ⚠ この時間帯は {doubleBook} の面談と重なっています
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <p className="label-xs mb-2">備考</p>
              <textarea
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--text-2)] resize-none transition-colors"
                placeholder="気になること、フォロー事項…"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Email draft */}
            <div>
              <p className="label-xs mb-2">メール下書き</p>
              <textarea
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--text-2)] resize-none transition-colors font-mono"
                placeholder="店長へのメール文をここに…"
                rows={4}
                value={emailDraft}
                onChange={e => setEmailDraft(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold hover:opacity-80 disabled:opacity-50 transition-all"
          >
            {saving ? "保存中…" : "記録を保存"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Question manager ──────────────────────────────────────────────────────────

function QuestionManager({ questions, onRefresh }: { questions: Question[]; onRefresh: () => void }) {
  const [newText, setNewText] = useState("")
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!newText.trim()) return
    setSaving(true)
    await saveQuestion(newText.trim(), questions.length)
    setNewText("")
    onRefresh()
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-2 py-1">
            <span className="text-[0.65rem] text-[var(--text-3)] w-5 shrink-0 text-right">{i + 1}.</span>
            <span className="flex-1 text-sm text-[var(--text)]">{q.text}</span>
            <button
              onClick={async () => { await deleteQuestion(q.id); onRefresh() }}
              className="text-[var(--text-3)] hover:text-red-400 transition-colors shrink-0"
            ><Icon name="close" size={14} /></button>
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-[0.75rem] text-[var(--text-3)]">まだ質問がありません。</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--text-2)] transition-colors"
          placeholder="新しい質問を追加…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={saving || !newText.trim()}
          className="px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.75rem] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity"
        >追加</button>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, dueDate }: { status: MilestoneStatus; dueDate: Date }) {
  const d = daysFromToday(dueDate)
  if (status === "done") return <span className="text-[0.65rem] text-green-500 font-medium">完了</span>
  if (status === "overdue") return <span className="text-[0.65rem] text-red-400 font-medium">{Math.abs(d)}日超過</span>
  if (status === "soon") return <span className="text-[0.65rem] text-yellow-500 font-medium">あと{d}日</span>
  return <span className="text-[0.65rem] text-[var(--text-3)]">あと{d}日</span>
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportToExcel(rows: WorkerRow[], questions: Question[], mode: "matome" | "single") {
  const wb = XLSX.utils.book_new()
  const today = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")

  function makeRows(r: WorkerRow) {
    const out: (string | number)[][] = []
    const name = r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "—"
    const iv = r.completedInterview
    const prev = r.prevInterview

    out.push(["氏名", name])
    out.push(["サポート担当", r.worker.support_staff ?? "—"])
    out.push(["面談種別", r.milestone.label])
    out.push(["期限", r.dueDate.toLocaleDateString("ja-JP")])
    out.push(["実施日", iv ? new Date(iv.conducted_at).toLocaleDateString("ja-JP") : "未実施"])
    out.push([])

    if (questions.length > 0) {
      const hasPrev = prev && prev.answers.length > 0
      out.push(hasPrev ? ["質問", "今回", `前回 (${prev.milestone})`] : ["質問", "回答"])
      for (const q of questions) {
        const curr = iv?.answers.find(a => a.question_id === q.id)?.answer ?? null
        const currLabel = curr === true ? "はい" : curr === false ? "いいえ" : "—"
        if (hasPrev) {
          const p = prev.answers.find(a => a.question_id === q.id)?.answer ?? null
          out.push([q.text, currLabel, p === true ? "はい" : p === false ? "いいえ" : "—"])
        } else {
          out.push([q.text, currLabel])
        }
      }
      out.push([])
    }

    out.push(["備考", iv?.notes ?? ""])
    return out
  }

  if (mode === "matome") {
    const all: (string | number)[][] = []
    rows.forEach((r, i) => {
      if (i > 0) all.push([], ["─────────────────"])
      all.push(...makeRows(r))
    })
    const ws = XLSX.utils.aoa_to_sheet(all)
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, "定期面談")
    XLSX.writeFile(wb, `定期面談_${today}.xlsx`)
  } else {
    rows.forEach(r => {
      const ws = XLSX.utils.aoa_to_sheet(makeRows(r))
      ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
      const sheetName = (r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "worker").slice(0, 28)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })
    XLSX.writeFile(wb, `定期面談_個別_${today}.xlsx`)
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "all" | "overdue" | "soon" | "done"

export default function MeetingsPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [staffFilter, setStaffFilter] = useState("全員")
  const [tab, setTab] = useState<Tab>("soon")
  const [showQuestions, setShowQuestions] = useState(false)
  const [activeRow, setActiveRow] = useState<WorkerRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [ws, qs, ivs] = await Promise.all([getWorkers(), getQuestions(), getAllInterviews()])
    setWorkers(ws)
    setQuestions(qs)
    setInterviews(ivs)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Build milestone rows from workers + interviews
  const allRows = useMemo<WorkerRow[]>(() => {
    const rows: WorkerRow[] = []
    for (const w of workers) {
      if (!w.first_work_date) continue
      const workerIvs = interviews.filter(iv => iv.worker_id === (w.worker_id ?? w.id))

      MILESTONES.forEach((ms, mi) => {
        const dueDate = milestoneDate(w.first_work_date!, ms.days)
        const done = workerIvs.find(iv => iv.milestone === ms.key) ?? null
        const prevMs = MILESTONES[mi - 1]
        const prevInterview = prevMs
          ? workerIvs.find(iv => iv.milestone === prevMs.key) ?? null
          : null
        rows.push({
          worker: w,
          milestone: ms,
          dueDate,
          status: getMilestoneStatus(dueDate, !!done),
          completedInterview: done,
          prevInterview,
        })
      })
    }
    return rows
  }, [workers, interviews])

  // Staff options for filter
  const staffOptions = useMemo(() => {
    const names = new Set(workers.map(w => w.support_staff).filter(Boolean) as string[])
    return ["全員", ...Array.from(names).sort()]
  }, [workers])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows
      .filter(r => staffFilter === "全員" || r.worker.support_staff === staffFilter)
      .filter(r => {
        if (tab === "overdue") return r.status === "overdue"
        if (tab === "soon") return r.status === "soon" || r.status === "overdue"
        if (tab === "done") return r.status === "done"
        return r.status !== "done"
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [allRows, staffFilter, tab])

  const rowKey = (r: WorkerRow) => `${r.worker.id}-${r.milestone.key}`

  function toggleSelect(r: WorkerRow) {
    const k = rowKey(r)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const selectedRows = filteredRows.filter(r => selected.has(rowKey(r)))

  async function handleSave(row: WorkerRow, answers: WorkerAnswers, notes: string, emailDraft: string, scheduledAt: string) {
    await saveInterview(
      row.worker.worker_id ?? row.worker.id,
      row.milestone.key,
      null,
      notes,
      emailDraft,
      Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
      scheduledAt ? new Date(scheduledAt).toISOString() : null,
    )
    setActiveRow(null)
    await loadAll()
  }

  const loadQuestions = useCallback(async () => {
    setQuestions(await getQuestions())
  }, [])

  const counts = useMemo(() => ({
    overdue: allRows.filter(r => (staffFilter === "全員" || r.worker.support_staff === staffFilter) && r.status === "overdue").length,
    soon:    allRows.filter(r => (staffFilter === "全員" || r.worker.support_staff === staffFilter) && r.status === "soon").length,
    all:     allRows.filter(r => (staffFilter === "全員" || r.worker.support_staff === staffFilter) && r.status !== "done").length,
    done:    allRows.filter(r => (staffFilter === "全員" || r.worker.support_staff === staffFilter) && r.status === "done").length,
  }), [allRows, staffFilter])

  return (
    <>
      <PageHeader
        title="定期面談"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestions(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded border text-[0.72rem] font-medium transition-all",
                showQuestions
                  ? "border-[var(--text)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
              )}
            >
              <Icon name="settings" size={13} />
              質問管理
            </button>
          </div>
        }
      />

      <PageContent>
        <div className="flex flex-col gap-5">

          {/* Question manager */}
          {showQuestions && (
            <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-2)]">
              <p className="label-xs mb-3">質問リスト</p>
              <QuestionManager questions={questions} onRefresh={loadQuestions} />
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <PillTabs
              options={[
                { value: "soon"    as Tab, label: `要対応 ${counts.overdue > 0 ? `(超過${counts.overdue})` : `(${counts.soon}件)`}` },
                { value: "all"     as Tab, label: `未実施 ${counts.all}` },
                { value: "done"    as Tab, label: `完了 ${counts.done}` },
              ]}
              value={tab}
              onChange={setTab}
            />
            <div className="flex gap-1 flex-wrap">
              {staffOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setStaffFilter(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all",
                    staffFilter === s
                      ? "bg-[var(--text)] text-[var(--bg)]"
                      : "bg-[var(--bg-2)] text-[var(--text-2)] hover:text-[var(--text)]"
                  )}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Export bar (shows when rows are selected) */}
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg">
              <span className="text-sm text-[var(--text-2)]">{selectedRows.length}件選択</span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => exportToExcel(selectedRows, questions, "matome")}
                  className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-all"
                >まとめてExcel</button>
                <button
                  onClick={() => exportToExcel(selectedRows, questions, "single")}
                  className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-all"
                >個別Excel</button>
                <button onClick={() => setSelected(new Set())} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors ml-1">
                  クリア
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <p className="text-sm text-[var(--text-3)] animate-pulse">読み込み中…</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">該当する面談はありません。</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border-soft)]">
              {filteredRows.map(row => {
                const k = rowKey(row)
                const isSelected = selected.has(k)
                return (
                  <div
                    key={k}
                    className={cn(
                      "flex items-center gap-3 py-2.5 px-1 rounded transition-colors",
                      isSelected && "bg-[var(--bg-2)]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(row)}
                      className="shrink-0 accent-[var(--highlight)]"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-[1fr_60px_90px_70px_80px] gap-3 items-center">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text)] truncate">
                          {row.worker.name_latin ?? row.worker.name_kana ?? row.worker.worker_id}
                        </p>
                        <p className="text-[0.65rem] text-[var(--text-3)]">
                          {row.worker.worker_id} · {row.worker.support_staff ?? "—"}
                        </p>
                      </div>
                      <span className="text-[0.72rem] font-mono text-[var(--text-2)] shrink-0">{row.milestone.label}</span>
                      <span className="text-[0.72rem] text-[var(--text-3)] shrink-0">{row.dueDate.toLocaleDateString("ja-JP")}</span>
                      <StatusBadge status={row.status} dueDate={row.dueDate} />
                      {row.status === "done" ? (
                        <span className="text-[0.65rem] text-[var(--text-3)]">
                          {new Date(row.completedInterview!.conducted_at).toLocaleDateString("ja-JP")}
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveRow(row)}
                          className="text-[0.72rem] px-2.5 py-1 rounded bg-[var(--bg-2)] text-[var(--text-2)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all font-medium"
                        >面談する</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PageContent>

      {/* Interview slide panel */}
      {activeRow && (
        <InterviewForm
          row={activeRow}
          questions={questions}
          onSave={(answers, notes, emailDraft, scheduledAt) => handleSave(activeRow, answers, notes, emailDraft, scheduledAt)}
          onClose={() => setActiveRow(null)}
        />
      )}
    </>
  )
}
