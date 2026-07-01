"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { parseOkurikomiCsv, applyParsedMoveRows, type ParsedMoveRow } from "@/app/actions/workerLocations"

type Stage = "upload" | "preview" | "done"

const CONF_STYLE: Record<ParsedMoveRow["match_confidence"], { row: string; dot: string; label: string }> = {
  exact:     { row: "bg-green-500/10",  dot: "🟢", label: "マッチ" },
  name_only: { row: "bg-yellow-500/10", dot: "🟡", label: "名前のみ" },
  unmatched: { row: "bg-red-500/10",    dot: "🔴", label: "スキップ" },
}

export default function MoveImport({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [stage, setStage] = useState<Stage>("upload")
  const [rows, setRows] = useState<ParsedMoveRow[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null)
    try {
      // Japanese Excel exports are sometimes UTF-8, sometimes Shift-JIS.
      // Try UTF-8 strictly; fall back to Shift-JIS if it isn't valid UTF-8.
      const buf = await file.arrayBuffer()
      let text: string
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf)
      } catch {
        text = new TextDecoder("shift-jis").decode(buf)
      }
      const parsed = await parseOkurikomiCsv(text)
      setRows(parsed)
      // default: import every row that matched a worker
      setChecked(new Set(parsed.map((p, i) => (p.matched_worker_id ? i : -1)).filter(i => i >= 0)))
      setStage("preview")
      if (parsed.length === 0) setError("インドネシア人の行が見つかりませんでした。")
    } catch {
      setError("CSVの読み込みに失敗しました。")
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  async function runImport() {
    setLoading(true); setError(null)
    const selected = rows.filter((_, i) => checked.has(i))
    const res = await applyParsedMoveRows(selected)
    setResult(res)
    setStage("done")
    setLoading(false)
    onImported()
  }

  const counts = {
    exact: rows.filter(r => r.match_confidence === "exact").length,
    name_only: rows.filter(r => r.match_confidence === "name_only").length,
    unmatched: rows.filter(r => r.match_confidence === "unmatched").length,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <p className="text-base font-semibold text-[var(--text)]">📥 送り込みCSVインポート</p>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {stage === "upload" && (
            <div className="flex flex-col items-center gap-4 py-10">
              <p className="text-[0.85rem] text-[var(--text-2)]">送り込みスケジュールのCSVを選択してください。</p>
              <label className="px-4 py-2 rounded text-[0.8rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity font-medium cursor-pointer">
                {loading ? "読み込み中…" : "CSVファイルを選択"}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={loading} />
              </label>
              {error && <p className="text-[0.78rem] text-red-400">{error}</p>}
            </div>
          )}

          {stage === "preview" && (
            <div className="flex flex-col gap-3">
              <p className="text-[0.8rem] text-[var(--text-2)]">
                ✅ {counts.exact}件マッチ　⚠️ {counts.name_only}件名前のみ　❌ {counts.unmatched}件スキップ
              </p>
              {error && <p className="text-[0.78rem] text-red-400">{error}</p>}
              <div className="overflow-x-auto rounded border border-[var(--border)]">
                <table className="w-full text-[0.75rem] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-2)] text-left">
                      {["", "マッチ", "従業員番号", "名前", "店舗CD", "入居日", "初出勤日", "住所"].map((h, i) => (
                        <th key={i} className="px-3 py-2 font-medium text-[var(--text-2)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const s = CONF_STYLE[r.match_confidence]
                      const disabled = !r.matched_worker_id
                      return (
                        <tr key={i} className={cn("border-b border-[var(--border)] last:border-0", s.row)}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="accent-[var(--text)]"
                              checked={checked.has(i)}
                              disabled={disabled}
                              onChange={() => toggleRow(i)}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {s.dot} {s.label}
                            {r.match_confidence === "name_only" && r.matched_worker_name && (
                              <span className="block text-[0.65rem] text-[var(--text-3)]">→ {r.matched_worker_name}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--text-2)] font-mono">{r.employee_no || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--text)]">{r.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--text-2)]">{r.store_code || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--text-2)]">{r.move_in_date || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[var(--text-2)]">{r.first_work_date || "—"}</td>
                          <td className="px-3 py-2 max-w-[220px] truncate text-[var(--text-3)]">{r.housing_address || "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stage === "done" && result && (
            <div className="flex flex-col gap-3 py-6">
              <p className="text-[0.9rem] text-[var(--text)] font-medium">
                {result.created}件追加、{result.skipped}件スキップ、エラー: {result.errors.length}
              </p>
              {result.errors.length > 0 && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 flex flex-col gap-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[0.72rem] text-red-400">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)] shrink-0">
          {stage === "preview" && (
            <>
              <button onClick={onClose} className="px-3 py-1.5 rounded text-[0.78rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                キャンセル
              </button>
              <button
                onClick={runImport}
                disabled={loading || checked.size === 0}
                className="px-4 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
              >
                {loading ? "インポート中…" : `インポート実行 (${checked.size})`}
              </button>
            </>
          )}
          {stage === "done" && (
            <button onClick={onClose} className="px-4 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity font-medium">
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
