"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import {
  parseOkurikomiCsv,
  applyParsedMoveRows,
  applyWorkerFieldsFromCsv,
  undoMoveImport,
  type ParsedMoveRow,
} from "@/app/actions/workerLocations"
import { CSV_WORKER_FIELD_MAP, type WorkerFieldKey } from "@/lib/moveFields"

type Stage = "upload" | "preview" | "done"
type PreviewTab = "moves" | "workers"

const CONF_STYLE: Record<ParsedMoveRow["match_confidence"], { row: string; dot: string; label: string }> = {
  exact:     { row: "bg-green-500/10",  dot: "🟢", label: "マッチ" },
  name_only: { row: "bg-yellow-500/10", dot: "🟡", label: "名前のみ" },
  unmatched: { row: "bg-red-500/10",    dot: "🔴", label: "スキップ" },
}

function csvVal(r: ParsedMoveRow, csvKey: string): string {
  const v = r[csvKey as keyof ParsedMoveRow]
  return v === null || v === undefined ? "" : String(v)
}
function curVal(r: ParsedMoveRow, currentKey: string): string {
  const v = r[currentKey as keyof ParsedMoveRow]
  return v === null || v === undefined ? "" : String(v)
}
function cellStatus(csv: string, cur: string): "fill" | "overwrite" | "same" | "empty" {
  if (!csv) return "empty"
  if (!cur) return "fill"
  return csv.trim() === cur.trim() ? "same" : "overwrite"
}

export default function MoveImport({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [stage, setStage] = useState<Stage>("upload")
  const [previewTab, setPreviewTab] = useState<PreviewTab>("moves")
  const [rows, setRows] = useState<ParsedMoveRow[]>([])
  const [checkedMoves, setCheckedMoves] = useState<Set<number>>(new Set())
  const [selectedFields, setSelectedFields] = useState<Set<WorkerFieldKey>>(new Set(CSV_WORKER_FIELD_MAP.map(f => f.workerKey)))
  const [overwrite, setOverwrite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number; skipped: number; errors: string[]
    created_ids: string[]; updated: number; fieldErrors: string[]
  } | null>(null)
  const [undone, setUndone] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null)
    try {
      const buf = await file.arrayBuffer()
      let text: string
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf) }
      catch { text = new TextDecoder("shift-jis").decode(buf) }
      const parsed = await parseOkurikomiCsv(text)
      setRows(parsed)
      setCheckedMoves(new Set(parsed.map((p, i) => (p.matched_worker_id ? i : -1)).filter(i => i >= 0)))
      setStage("preview")
      if (parsed.length === 0) setError("インドネシア人の行が見つかりませんでした。")
    } catch {
      setError("CSVの読み込みに失敗しました。")
    } finally { setLoading(false) }
  }

  function toggleMove(i: number) {
    setCheckedMoves(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }

  function toggleField(k: WorkerFieldKey) {
    setSelectedFields(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  }

  async function runImport() {
    setLoading(true); setError(null)
    const selectedMoveRows = rows.filter((_, i) => checkedMoves.has(i))
    const matchedRows = rows.filter(r => r.matched_worker_id)

    const [moveRes, fieldRes] = await Promise.all([
      applyParsedMoveRows(selectedMoveRows),
      selectedFields.size > 0 && matchedRows.length > 0
        ? applyWorkerFieldsFromCsv(matchedRows, [...selectedFields], overwrite)
        : Promise.resolve({ updated: 0, errors: [] }),
    ])

    setResult({
      created: moveRes.created,
      skipped: moveRes.skipped,
      errors: moveRes.errors,
      created_ids: moveRes.created_ids,
      updated: fieldRes.updated,
      fieldErrors: fieldRes.errors,
    })
    setStage("done")
    setLoading(false)
    onImported()
  }

  const matchedRows = rows.filter(r => r.matched_worker_id)
  const counts = {
    exact:     rows.filter(r => r.match_confidence === "exact").length,
    name_only: rows.filter(r => r.match_confidence === "name_only").length,
    unmatched: rows.filter(r => r.match_confidence === "unmatched").length,
  }

  // Per-column summary for the worker fields tab
  const fieldSummary = CSV_WORKER_FIELD_MAP.map(f => {
    let fills = 0, overwrites = 0
    for (const r of matchedRows) {
      const status = cellStatus(csvVal(r, f.csvKey), curVal(r, f.currentKey))
      if (status === "fill") fills++
      else if (status === "overwrite") overwrites++
    }
    return { ...f, fills, overwrites }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
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
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">

          {/* Upload */}
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

          {/* Preview */}
          {stage === "preview" && (
            <div className="flex flex-col gap-3">
              {/* Match summary */}
              <p className="text-[0.8rem] text-[var(--text-2)]">
                ✅ {counts.exact}件マッチ　⚠️ {counts.name_only}件名前のみ　❌ {counts.unmatched}件スキップ
              </p>
              {error && <p className="text-[0.78rem] text-red-400">{error}</p>}

              {/* Sub-tabs */}
              <div className="flex gap-1 border-b border-[var(--border)] -mx-4 px-4">
                {(["moves", "workers"] as PreviewTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setPreviewTab(t)}
                    className={cn(
                      "px-3 py-1.5 text-[0.78rem] border-b-2 -mb-px transition-colors",
                      previewTab === t
                        ? "border-[var(--text)] text-[var(--text)] font-medium"
                        : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]"
                    )}
                  >
                    {t === "moves" ? `引越し記録 (${checkedMoves.size})` : `従業員データ更新 (${selectedFields.size}項目)`}
                  </button>
                ))}
              </div>

              {/* Move records tab */}
              {previewTab === "moves" && (
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
                              <input type="checkbox" className="accent-[var(--text)]"
                                checked={checkedMoves.has(i)} disabled={disabled}
                                onChange={() => toggleMove(i)} />
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
                            <td className="px-3 py-2 max-w-[200px] truncate text-[var(--text-3)]">{r.housing_address || "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Worker fields diff tab */}
              {previewTab === "workers" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[0.75rem] text-[var(--text-3)]">
                      <span className="inline-block w-3 h-3 rounded-sm bg-green-500/30 mr-1" />空欄を埋める
                      <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500/30 ml-3 mr-1" />上書き
                    </span>
                    <label className="flex items-center gap-1.5 text-[0.75rem] text-[var(--text-2)] cursor-pointer ml-auto">
                      <input type="checkbox" className="accent-[var(--text)]"
                        checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                      既存データも上書きする
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded border border-[var(--border)]">
                    <table className="text-[0.72rem] border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-2)]">
                          <th className="px-3 py-2 text-left font-medium text-[var(--text-2)] whitespace-nowrap sticky left-0 bg-[var(--bg-2)] z-10">名前</th>
                          {fieldSummary.map(f => (
                            <th key={f.workerKey} className="px-2 py-1.5 whitespace-nowrap text-center">
                              <label className="flex flex-col items-center gap-0.5 cursor-pointer">
                                <input type="checkbox" className="accent-[var(--text)]"
                                  checked={selectedFields.has(f.workerKey)}
                                  onChange={() => toggleField(f.workerKey)} />
                                <span className={cn("font-medium", selectedFields.has(f.workerKey) ? "text-[var(--text)]" : "text-[var(--text-3)]")}>{f.label}</span>
                                <span className="text-[0.6rem] font-normal text-[var(--text-3)]">
                                  {f.fills > 0 && <span className="text-green-400">+{f.fills}</span>}
                                  {f.fills > 0 && f.overwrites > 0 && " "}
                                  {f.overwrites > 0 && <span className="text-yellow-400">↺{f.overwrites}</span>}
                                  {f.fills === 0 && f.overwrites === 0 && "—"}
                                </span>
                              </label>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matchedRows.length === 0 ? (
                          <tr><td colSpan={CSV_WORKER_FIELD_MAP.length + 1} className="px-3 py-6 text-center text-[var(--text-3)]">マッチした従業員がいません</td></tr>
                        ) : matchedRows.map((r, i) => (
                          <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)]">
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-[var(--text)] sticky left-0 bg-[var(--bg)] z-10">{r.name}</td>
                            {fieldSummary.map(f => {
                              const csv = csvVal(r, f.csvKey)
                              const cur = curVal(r, f.currentKey)
                              const status = cellStatus(csv, cur)
                              const included = selectedFields.has(f.workerKey)
                              const willApply = included && (status === "fill" || (status === "overwrite" && overwrite))
                              return (
                                <td key={f.workerKey}
                                  className={cn(
                                    "px-2 py-1.5 text-center whitespace-nowrap max-w-[120px] truncate transition-colors",
                                    !included && "opacity-30",
                                    willApply && status === "fill" && "bg-green-500/15",
                                    willApply && status === "overwrite" && "bg-yellow-500/15",
                                  )}
                                  title={status === "overwrite" ? `現在: ${cur}\n→ ${csv}` : csv}
                                >
                                  {status === "empty" ? (
                                    <span className="text-[var(--text-3)]">—</span>
                                  ) : status === "same" ? (
                                    <span className="text-[var(--text-3)]">{csv}</span>
                                  ) : status === "fill" ? (
                                    <span className="text-green-400 font-medium">{csv}</span>
                                  ) : (
                                    <span className="text-yellow-400">
                                      <span className="line-through text-[var(--text-3)] mr-1 text-[0.65rem]">{cur}</span>
                                      {csv}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[0.72rem] text-[var(--text-3)]">
                    列のチェックを外すと、その項目は更新されません。上書きオプションをオンにすると黄色セルも更新します。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {stage === "done" && result && (
            <div className="flex flex-col gap-3 py-6">
              {undone ? (
                <p className="text-[0.9rem] text-[var(--text)] font-medium">
                  ✅ 引越し記録 {result.created_ids.length}件を削除しました。（従業員データの変更は元に戻せません）
                </p>
              ) : (
                <>
                  <p className="text-[0.9rem] text-[var(--text)] font-medium">
                    引越し記録: {result.created}件追加、{result.skipped}件スキップ
                  </p>
                  <p className="text-[0.9rem] text-[var(--text)] font-medium">
                    従業員データ: {result.updated}件更新
                  </p>
                </>
              )}
              {(result.errors.length > 0 || result.fieldErrors.length > 0) && !undone && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 flex flex-col gap-1">
                  {[...result.errors, ...result.fieldErrors].map((err, i) => (
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
                disabled={loading || (checkedMoves.size === 0 && selectedFields.size === 0)}
                className="px-4 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
              >
                {loading ? "インポート中…" : `インポート実行`}
              </button>
            </>
          )}
          {stage === "done" && (
            <>
              {result && result.created_ids.length > 0 && !undone && (
                <button
                  onClick={async () => {
                    setLoading(true)
                    await undoMoveImport(result.created_ids)
                    setUndone(true); setLoading(false); onImported()
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 rounded text-[0.78rem] border border-[var(--border)] text-[var(--text-3)] hover:text-red-400 hover:border-red-400 transition-colors disabled:opacity-50"
                >
                  {loading ? "削除中…" : "↩ 引越し記録を元に戻す"}
                </button>
              )}
              <button onClick={onClose} className="px-4 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity font-medium">
                閉じる
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
