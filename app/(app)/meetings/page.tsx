"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import ExcelJS from "exceljs"
import { getWorkers, type Worker } from "@/app/actions/workers"
import {
  getQuestions, saveQuestion, deleteQuestion,
  getAllInterviews, saveInterview, skipMilestone,
  type Question, type Interview, type InterviewFormData,
} from "@/app/actions/interviews"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent, PillTabs } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import InterviewFormFull, {
  TENCHO_SECTIONS, WORKER_SECTION_GROUPS, LEGAL_SECTION_GROUPS, FIELD_LABELS, TENCHO_RESPONSE_LABEL,
  type WorkerAnswers,
} from "@/components/meetings/InterviewFormFull"

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
  prevInterview: Interview | null
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

const THIN: ExcelJS.Border = { style: "thin", color: { argb: "FF000000" } }
const ALL_BORDERS: Partial<ExcelJS.Borders> = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a1a" } }
const SECTION_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFe5e4df" } }

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFffffff" }, size: 10 }
  row.fill = HEADER_FILL
  row.eachCell(c => { c.border = ALL_BORDERS })
}

function styleSection(row: ExcelJS.Row) {
  row.font = { bold: true, size: 10 }
  row.fill = SECTION_FILL
  row.eachCell(c => { c.border = ALL_BORDERS })
}

function styleData(row: ExcelJS.Row) {
  row.font = { size: 10 }
  row.eachCell(c => { c.border = ALL_BORDERS })
}

function addSheetForWorker(wb: ExcelJS.Workbook, r: WorkerRow, questions: Question[], sheetName: string) {
  const ws = wb.addWorksheet(sheetName)
  // 3-column layout: content | 有 | 無
  ws.columns = [{ width: 56 }, { width: 6 }, { width: 6 }]

  const name    = r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "—"
  const staff   = r.worker.support_staff ?? "—"
  const iv      = r.completedInterview
  const prev    = r.prevInterview
  const hasPrev = !!(prev && prev.answers.length > 0)
  const dateStr = iv ? new Date(iv.conducted_at).toLocaleDateString("ja-JP") : new Date().toLocaleDateString("ja-JP")
  const fd      = iv?.form_data ?? null

  function mergeAC(rowNum: number) { ws.mergeCells(`A${rowNum}:C${rowNum}`) }
  function lastRowNum() { return ws.lastRow!.number }

  function addTextRow(text: string, height = 0) {
    const row = ws.addRow([text])
    mergeAC(lastRowNum())
    row.getCell(1).alignment = { wrapText: true }
    if (height) row.height = height
    row.eachCell(c => { c.border = ALL_BORDERS })
    return row
  }

  function getFormField(area: "tencho" | "worker", key: string, field: string): string {
    return (fd?.[area] as Record<string, Record<string, string>> | undefined)?.[key]?.[field] ?? ""
  }

  function getAnswer(questionId: string): boolean | null {
    // try by id first, then match by text against default question ids
    const byId = iv?.answers.find(a => a.question_id === questionId)
    if (byId !== undefined) return byId.answer
    return null
  }

  // For default questions (dq-1 … dq-8), match them against real DB question ids via text
  function getAnswerForLegal(text: string): boolean | null {
    const q = questions.find(qq => qq.text === text)
    if (!q) return null
    return iv?.answers.find(a => a.question_id === q.id)?.answer ?? null
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  const r1 = ws.addRow(["就業者定期面談シート", "担当者：", staff])
  r1.getCell(1).font = { bold: true, size: 13 }
  r1.getCell(1).alignment = { horizontal: "center" }
  r1.eachCell(c => { c.border = ALL_BORDERS })

  const r2 = ws.addRow([`日付：${dateStr}`, "就業場所：", r.worker.store_name ?? ""])
  r2.eachCell(c => { c.border = ALL_BORDERS })

  const r3 = ws.addRow([`面談種別：${r.milestone.label}`, "人財氏名：", name])
  r3.eachCell(c => { c.border = ALL_BORDERS })

  ws.addRow([])

  // ── 法律範囲 ──────────────────────────────────────────────────────────────
  const legalHeaderRow = ws.addRow(["ヒアリング内容（法律範囲）", "有", "無"])
  styleHeader(legalHeaderRow)

  for (const group of LEGAL_SECTION_GROUPS) {
    const sh = ws.addRow([group.header, "", ""])
    styleSection(sh)
    mergeAC(lastRowNum())

    for (const gq of group.questions) {
      const ans = getAnswerForLegal(gq.text)
      const row = ws.addRow([gq.text, ans === true ? "●" : "", ans === false ? "●" : ""])
      styleData(row)
      if (ans === true)  row.getCell(2).font = { bold: true, size: 11 }
      if (ans === false) row.getCell(3).font = { bold: true, size: 11 }
    }
  }

  // Notes (legal section memo)
  ws.addRow([])
  const lNotesLabel = ws.addRow(["備考"])
  mergeAC(lastRowNum())
  styleSection(lNotesLabel)
  const lNotesRow = ws.addRow([iv?.notes ?? ""])
  mergeAC(lastRowNum())
  lNotesRow.getCell(1).alignment = { wrapText: true }
  lNotesRow.height = 50
  lNotesRow.eachCell(c => { c.border = ALL_BORDERS })

  if (iv?.email_draft) {
    const elLabel = ws.addRow(["メール下書き"])
    mergeAC(lastRowNum()); styleSection(elLabel)
    const elRow = ws.addRow([iv.email_draft])
    mergeAC(lastRowNum())
    elRow.getCell(1).alignment = { wrapText: true }
    elRow.height = 70
    elRow.eachCell(c => { c.border = ALL_BORDERS })
  }

  ws.addRow([])

  // ── 店長様 ────────────────────────────────────────────────────────────────
  const tHeader = ws.addRow(["ヒアリング内容（付加価値範囲）店舗店長様に対して", "", ""])
  styleHeader(tHeader); mergeAC(lastRowNum())

  for (const sec of TENCHO_SECTIONS) {
    const secRow = ws.addRow([sec.title, "", ""])
    styleSection(secRow); mergeAC(lastRowNum())

    // Hints as light reference lines
    if (sec.hints?.length) {
      for (const hint of sec.hints) {
        const hRow = ws.addRow([hint])
        mergeAC(lastRowNum())
        hRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF666666" } }
        hRow.getCell(1).alignment = { wrapText: true }
        hRow.height = 25
        hRow.eachCell(c => { c.border = ALL_BORDERS })
      }
    }

    // Fill-in fields — always rendered, with saved content or blank
    for (const fieldKey of sec.fields) {
      const label = fieldKey === "response" && sec.isTenchoResponse ? TENCHO_RESPONSE_LABEL : FIELD_LABELS[fieldKey as keyof typeof FIELD_LABELS] ?? fieldKey
      const value = getFormField("tencho", sec.key, fieldKey)

      const labelRow = ws.addRow([label])
      mergeAC(lastRowNum())
      labelRow.getCell(1).font = { size: 9, color: { argb: "FF444444" } }
      labelRow.eachCell(c => { c.border = ALL_BORDERS })

      const valueRow = ws.addRow([value])
      mergeAC(lastRowNum())
      valueRow.getCell(1).alignment = { wrapText: true }
      valueRow.height = value ? Math.max(35, Math.ceil(value.length / 55) * 15) : 40
      valueRow.eachCell(c => { c.border = ALL_BORDERS })
    }

    ws.addRow([])
  }

  // ── 人財 ──────────────────────────────────────────────────────────────────
  const wHeader = ws.addRow(["ヒアリング内容（付加価値範囲）人財に対して", "", ""])
  styleHeader(wHeader); mergeAC(lastRowNum())

  for (const grp of WORKER_SECTION_GROUPS) {
    const grpRow = ws.addRow([grp.group, "", ""])
    styleSection(grpRow); mergeAC(lastRowNum())

    for (const sec of grp.items) {
      // Prompt/question hint
      const promptRow = ws.addRow([sec.hints?.[0] ?? sec.title])
      mergeAC(lastRowNum())
      promptRow.getCell(1).font = { size: 10 }
      promptRow.getCell(1).alignment = { wrapText: true }
      promptRow.height = 25
      promptRow.eachCell(c => { c.border = ALL_BORDERS })

      for (const fieldKey of sec.fields) {
        const label = FIELD_LABELS[fieldKey as keyof typeof FIELD_LABELS] ?? fieldKey
        const value = getFormField("worker", sec.key, fieldKey)

        const labelRow = ws.addRow([label])
        mergeAC(lastRowNum())
        labelRow.getCell(1).font = { size: 9, color: { argb: "FF444444" } }
        labelRow.eachCell(c => { c.border = ALL_BORDERS })

        const valueRow = ws.addRow([value])
        mergeAC(lastRowNum())
        valueRow.getCell(1).alignment = { wrapText: true }
        valueRow.height = value ? Math.max(35, Math.ceil(value.length / 55) * 15) : 40
        valueRow.eachCell(c => { c.border = ALL_BORDERS })
      }
    }

    ws.addRow([])
  }
}

async function exportToExcel(rows: WorkerRow[], questions: Question[], mode: "matome" | "single") {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Tim Indo Serba Bisa"
  const today = new Date().toLocaleDateString("ja-JP").replace(/\//g, "-")

  if (mode === "matome") {
    rows.forEach(r => {
      const name = (r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "worker").slice(0, 28)
      addSheetForWorker(wb, r, questions, name)
    })
    const buf = await wb.xlsx.writeBuffer()
    download(buf, `定期面談_${today}.xlsx`)
  } else {
    rows.forEach(r => {
      const name = (r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "worker").slice(0, 28)
      const singleWb = new ExcelJS.Workbook()
      singleWb.creator = "Tim Indo Serba Bisa"
      addSheetForWorker(singleWb, r, questions, name)
      singleWb.xlsx.writeBuffer().then(buf => download(buf, `定期面談_${name}_${today}.xlsx`))
    })
  }
}

function download(buf: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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

  // One row per worker: their next relevant milestone.
  // "Relevant" = not done AND due within the last 90 days or in the future.
  // Very old unrecorded milestones (stale history) are skipped automatically.
  // For the 完了 tab we instead show the most-recently-completed milestone.
  const allRows = useMemo<WorkerRow[]>(() => {
    const rows: WorkerRow[] = []
    for (const w of workers) {
      if (!w.first_work_date) continue
      const wid = w.worker_id ?? w.id
      const workerIvs = interviews.filter(iv => iv.worker_id === wid)

      // Find the next actionable incomplete milestone
      let actionRow: WorkerRow | null = null
      for (let mi = 0; mi < MILESTONES.length; mi++) {
        const ms = MILESTONES[mi]
        const dueDate = milestoneDate(w.first_work_date!, ms.days)
        const done = workerIvs.find(iv => iv.milestone === ms.key) ?? null
        if (done) continue
        const daysOverdue = -daysFromToday(dueDate) // positive = overdue
        if (daysOverdue >= 90) continue // skip milestones that are stale history
        const prevMs = MILESTONES[mi - 1]
        const prevInterview = prevMs ? workerIvs.find(iv => iv.milestone === prevMs.key) ?? null : null
        actionRow = { worker: w, milestone: ms, dueDate, status: getMilestoneStatus(dueDate, false), completedInterview: null, prevInterview }
        break
      }

      // Most recently completed milestone (for 完了 tab)
      const latestDone = MILESTONES.slice().reverse().find(ms => workerIvs.find(iv => iv.milestone === ms.key))
      let doneRow: WorkerRow | null = null
      if (latestDone) {
        const iv = workerIvs.find(iv => iv.milestone === latestDone.key)!
        const mi = MILESTONES.findIndex(m => m.key === latestDone.key)
        const prevMs = MILESTONES[mi - 1]
        const prevInterview = prevMs ? workerIvs.find(iv2 => iv2.milestone === prevMs.key) ?? null : null
        doneRow = { worker: w, milestone: latestDone, dueDate: milestoneDate(w.first_work_date!, latestDone.days), status: "done", completedInterview: iv, prevInterview }
      }

      if (actionRow) rows.push(actionRow)
      else if (doneRow) rows.push(doneRow) // all milestones done → show latest in 完了
    }
    return rows
  }, [workers, interviews])

  // Staff options for filter
  const staffOptions = useMemo(() => {
    const names = new Set(workers.map(w => w.support_staff).filter(Boolean) as string[])
    return ["全員", ...Array.from(names).sort()]
  }, [workers])

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

  async function handleSave(row: WorkerRow, args: {
    answers: WorkerAnswers
    notes: string
    emailDraft: string
    scheduledAt: string
    formData: InterviewFormData
  }) {
    await saveInterview(
      row.worker.worker_id ?? row.worker.id,
      row.milestone.key,
      null,
      args.notes,
      args.emailDraft,
      Object.entries(args.answers).map(([question_id, answer]) => ({ question_id, answer })),
      args.scheduledAt ? new Date(args.scheduledAt).toISOString() : null,
      args.formData,
    )
    setActiveRow(null)
    await loadAll()
  }

  async function handleSkip(row: WorkerRow) {
    await skipMilestone(row.worker.worker_id ?? row.worker.id, row.milestone.key)
    await loadAll()
  }

  const loadQuestions = useCallback(async () => {
    setQuestions(await getQuestions())
  }, [])

  const staffRows = useMemo(() =>
    allRows.filter(r => staffFilter === "全員" || r.worker.support_staff === staffFilter)
  , [allRows, staffFilter])

  const counts = useMemo(() => ({
    overdue: staffRows.filter(r => r.status === "overdue").length,
    soon:    staffRows.filter(r => r.status === "soon").length,
    all:     staffRows.filter(r => r.status !== "done").length,
    done:    staffRows.filter(r => r.status === "done").length,
  }), [staffRows])

  const filteredRows = useMemo(() => {
    return staffRows
      .filter(r => {
        if (tab === "soon") return r.status === "soon" || r.status === "overdue"
        if (tab === "all") return r.status !== "done"
        if (tab === "done") return r.status === "done"
        return true
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [staffRows, tab])

  const selectedRows = filteredRows.filter(r => selected.has(rowKey(r)))

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
                  onClick={() => void exportToExcel(selectedRows, questions, "matome")}
                  className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-all"
                >まとめてExcel</button>
                <button
                  onClick={() => void exportToExcel(selectedRows, questions, "single")}
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
                    <div className="flex-1 min-w-0 grid grid-cols-[1fr_60px_90px_70px_auto] gap-3 items-center">
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
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setActiveRow(row)}
                            className="text-[0.72rem] px-2.5 py-1 rounded bg-[var(--bg-2)] text-[var(--text-2)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all font-medium whitespace-nowrap"
                          >面談する</button>
                          <button
                            onClick={() => void handleSkip(row)}
                            title="実施済みとしてスキップ"
                            className="text-[0.65rem] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all whitespace-nowrap"
                          >スキップ</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PageContent>

      {/* Full-screen interview form */}
      {activeRow && (
        <InterviewFormFull
          worker={activeRow.worker}
          milestone={activeRow.milestone.key}
          milestoneLabel={activeRow.milestone.label}
          dueDate={activeRow.dueDate}
          questions={questions}
          prevInterview={activeRow.prevInterview}
          onSave={args => handleSave(activeRow, args)}
          onClose={() => setActiveRow(null)}
        />
      )}
    </>
  )
}
