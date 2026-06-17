"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import ExcelJS from "exceljs"
import { getWorkers, type Worker } from "@/app/actions/workers"
import {
  getQuestions, saveQuestion, deleteQuestion,
  getAllInterviews, saveInterview,
  type Question, type Interview, type Answer, type FormData,
} from "@/app/actions/interviews"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent, PillTabs } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import InterviewFormFull, {
  TENCHO_SECTIONS, WORKER_SECTION_GROUPS, FIELD_LABELS, TENCHO_RESPONSE_LABEL,
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
  ws.columns = [
    { width: 42 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ]

  const name     = r.worker.name_latin ?? r.worker.name_kana ?? r.worker.worker_id ?? "—"
  const staff    = r.worker.support_staff ?? "—"
  const iv       = r.completedInterview
  const prev     = r.prevInterview
  const hasPrev  = !!(prev && prev.answers.length > 0)
  const dateStr  = iv ? new Date(iv.conducted_at).toLocaleDateString("ja-JP") : ""
  const today    = new Date().toLocaleDateString("ja-JP")

  // ── Title header ─────────────────────────────────────────────────────────
  const titleRow = ws.addRow(["就業者定期面談シート", "", "担当者氏名：", staff])
  ws.mergeCells(`A${titleRow.number}:B${titleRow.number}`)
  titleRow.getCell(1).font = { bold: true, size: 13 }
  titleRow.getCell(1).alignment = { horizontal: "center" }
  titleRow.eachCell(c => { c.border = ALL_BORDERS })

  const dateRow = ws.addRow([`日付：${dateStr || today}`, "", "就業場所：", r.worker.store_name ?? ""])
  ws.mergeCells(`A${dateRow.number}:B${dateRow.number}`)
  dateRow.eachCell(c => { c.border = ALL_BORDERS })

  const nameRow = ws.addRow([`面談種別：${r.milestone.label}`, "", "人財氏名：", name])
  ws.mergeCells(`A${nameRow.number}:B${nameRow.number}`)
  nameRow.eachCell(c => { c.border = ALL_BORDERS })

  ws.addRow([])

  // ── Legal section ─────────────────────────────────────────────────────────
  styleHeader(ws.addRow(["ヒアリング内容（法律範囲）", "", "問題の有無", hasPrev ? `前回(${prev?.milestone})` : ""]))
  ws.mergeCells(`A${ws.lastRow!.number}:B${ws.lastRow!.number}`)

  const LEGAL_SECTIONS: ({ section: string; question?: never } | { question: string; section?: never })[] = [
    { section: "業務内容について" },
    { question: "仕事内容は変更ないか？" },
    { question: "仕事場所は変更ないか？" },
    { section: "待遇について" },
    { question: "お給料は変更ないか？" },
    { question: "お休みは取れているか？" },
    { question: "家は変わっていないか？" },
    { section: "保護について" },
    { question: "会社や同僚から暴行・脅迫等の不法行為はないか？" },
    { section: "生活について" },
    { question: "日常生活でトラブルはないか？" },
    { question: "健康状態は問題ないか？" },
  ]

  for (const item of LEGAL_SECTIONS) {
    if (item.section) {
      styleSection(ws.addRow([item.section, "", "", ""]))
      ws.mergeCells(`A${ws.lastRow!.number}:D${ws.lastRow!.number}`)
    } else {
      const q = questions.find(qq => qq.text === item.question)
      const curr = q ? (iv?.answers.find(a => a.question_id === q.id)?.answer ?? null) : null
      const currLabel = curr === true ? "有" : curr === false ? "無" : ""
      const prevLabel = q && hasPrev
        ? (prev?.answers.find(a => a.question_id === q.id)?.answer === false ? "無" : prev?.answers.find(a => a.question_id === q.id)?.answer === true ? "有" : "")
        : ""
      styleData(ws.addRow([item.question, "", currLabel, prevLabel]))
      ws.mergeCells(`A${ws.lastRow!.number}:B${ws.lastRow!.number}`)
    }
  }

  ws.addRow([])

  // ── Notes & extra questions ───────────────────────────────────────────────
  if (questions.length > 0) {
    const extraQuestions = questions.filter(q =>
      !LEGAL_SECTIONS.find(l => l.question === q.text)
    )
    if (extraQuestions.length > 0) {
      styleHeader(ws.addRow(["その他のヒアリング内容", "", "今回", hasPrev ? `前回(${prev?.milestone})` : ""]))
      ws.mergeCells(`A${ws.lastRow!.number}:B${ws.lastRow!.number}`)
      for (const q of extraQuestions) {
        const curr = iv?.answers.find(a => a.question_id === q.id)?.answer ?? null
        const currLabel = curr === true ? "はい" : curr === false ? "いいえ" : "—"
        const prevAns = hasPrev ? prev?.answers.find(a => a.question_id === q.id)?.answer ?? null : null
        const prevLabel = prevAns === true ? "はい" : prevAns === false ? "いいえ" : ""
        styleData(ws.addRow([q.text, "", currLabel, prevLabel]))
        ws.mergeCells(`A${ws.lastRow!.number}:B${ws.lastRow!.number}`)
      }
      ws.addRow([])
    }
  }

  // ── Memo / notes ─────────────────────────────────────────────────────────
  styleSection(ws.addRow(["備考"]))
  ws.mergeCells(`A${ws.lastRow!.number}:D${ws.lastRow!.number}`)
  const notesRow = ws.addRow([iv?.notes ?? ""])
  notesRow.getCell(1).alignment = { wrapText: true }
  notesRow.height = 60
  ws.mergeCells(`A${notesRow.number}:D${notesRow.number}`)
  notesRow.eachCell(c => { c.border = ALL_BORDERS })

  if (iv?.email_draft) {
    ws.addRow([])
    styleSection(ws.addRow(["メール下書き"]))
    ws.mergeCells(`A${ws.lastRow!.number}:D${ws.lastRow!.number}`)
    const emailRow = ws.addRow([iv.email_draft])
    emailRow.getCell(1).alignment = { wrapText: true }
    emailRow.height = 80
    ws.mergeCells(`A${emailRow.number}:D${emailRow.number}`)
    emailRow.eachCell(c => { c.border = ALL_BORDERS })
  }

  const fd = iv?.form_data

  // ── 店長様 section ────────────────────────────────────────────────────────
  if (fd?.tencho && Object.keys(fd.tencho).length > 0) {
    ws.addRow([])
    ws.columns = [{ width: 20 }, { width: 30 }, { width: 30 }, { width: 20 }]
    styleHeader(ws.addRow(["店長様に対して", "内容", "次回確認事項", "備考"]))
    for (const sec of TENCHO_SECTIONS) {
      const fs = fd.tencho[sec.key]
      if (!fs) continue
      styleSection(ws.addRow([sec.title]))
      ws.mergeCells(`A${ws.lastRow!.number}:D${ws.lastRow!.number}`)
      const fields: Array<{ label: string; key: keyof typeof fs }> = []
      if (sec.isTenchoResponse && fs.response) fields.push({ label: TENCHO_RESPONSE_LABEL, key: "response" })
      else if (!sec.isTenchoResponse && fs.response) fields.push({ label: FIELD_LABELS.response, key: "response" })
      if (fs.discussion) fields.push({ label: FIELD_LABELS.discussion, key: "discussion" })
      if (sec.key === "bad_case") {
        for (const k of ["when","where","who","what","why_how"] as const) {
          if (fs[k]) fields.push({ label: FIELD_LABELS[k], key: k })
        }
      }
      if (fs.next_actions) fields.push({ label: FIELD_LABELS.next_actions, key: "next_actions" })
      if (fs.notes) fields.push({ label: FIELD_LABELS.notes, key: "notes" })
      for (const f of fields) {
        const row = ws.addRow([f.label, fs[f.key] ?? ""])
        row.getCell(2).alignment = { wrapText: true }
        ws.mergeCells(`B${row.number}:D${row.number}`)
        styleData(row)
      }
    }
  }

  // ── 人財 section ─────────────────────────────────────────────────────────
  if (fd?.worker && Object.keys(fd.worker).length > 0) {
    ws.addRow([])
    styleHeader(ws.addRow(["人財に対して", "本人の反応", "アドバイス", "次回確認事項"]))
    for (const group of WORKER_SECTION_GROUPS) {
      styleSection(ws.addRow([group.group]))
      ws.mergeCells(`A${ws.lastRow!.number}:D${ws.lastRow!.number}`)
      for (const sec of group.items) {
        const fs = fd.worker[sec.key]
        if (!fs) continue
        const row = ws.addRow([
          sec.title,
          fs.response ?? "",
          fs.advice ?? "",
          fs.next_actions ?? "",
        ])
        row.eachCell(c => { c.alignment = { wrapText: true }; c.border = ALL_BORDERS })
        if (fs.notes) {
          const notesRow = ws.addRow(["", `備考: ${fs.notes}`])
          notesRow.getCell(2).font = { italic: true, size: 9 }
          ws.mergeCells(`B${notesRow.number}:D${notesRow.number}`)
          notesRow.eachCell(c => { c.border = ALL_BORDERS })
        }
      }
    }
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

  async function handleSave(row: WorkerRow, args: {
    answers: WorkerAnswers
    notes: string
    emailDraft: string
    scheduledAt: string
    formData: FormData
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
