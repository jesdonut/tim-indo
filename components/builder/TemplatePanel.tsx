"use client"

import { useState } from "react"
import { extractVars, applyTemplate, parsePaste } from "./templateUtils"
import { handleTableKeyDown } from "./useTableNav"
import { cn } from "@/lib/cn"
import type { ColDef, Row } from "./types"

const TABLE_ID = "builder-vars"

type Props = {
  template: string
  cols: ColDef[]
  rows: Row[]
  onTemplateChange: (t: string) => void
  onSyncCols: (vars: string[]) => void
  onRowsChange: (rows: Row[]) => void
}

export default function TemplatePanel({ template, cols, rows, onTemplateChange, onSyncCols, onRowsChange }: Props) {
  const [justCopied, setJustCopied] = useState<number | null>(null)

  const vars = extractVars(template)
  // Find which cols match detected vars (by label match)
  const varCols = vars
    .map(v => cols.find(c => c.label.toLowerCase() === v.toLowerCase() || c.id === `var_${v}`))
    .filter(Boolean) as ColDef[]

  const previews = rows.map(r => applyTemplate(template, r))

  async function clickCopy(i: number) {
    await navigator.clipboard.writeText(previews[i])
    setJustCopied(i)
    setTimeout(() => setJustCopied(null), 1000)
  }

  function setCell(rowIdx: number, colId: string, value: string) {
    const next = rows.map((r, i) => i === rowIdx ? { ...r, [colId]: value } : r)
    onRowsChange(next)
  }

  function addRow() { onRowsChange([...rows, {}]) }

  function onVarColPaste(e: React.ClipboardEvent, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text/plain")
    if (!text.includes("\t") && !text.includes("\n")) return
    e.preventDefault()
    const grid = parsePaste(text)
    const next = [...rows]
    grid.forEach((pasteRow, ri) => {
      const r = rowIdx + ri
      while (next.length <= r) next.push({})
      pasteRow.forEach((val, ci) => {
        const col = varCols[colIdx + ci]
        if (col) next[r] = { ...next[r], [col.id]: val }
      })
    })
    onRowsChange(next)
  }

  return (
    <div className="flex h-full min-h-0">

      {/* LEFT: template + outputs */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-[var(--border)]">

        {/* Template input */}
        <div className="flex flex-col gap-2 p-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="label-xs">Template</span>
            {vars.length > 0 && (
              <button
                onClick={() => onSyncCols(vars)}
                className="text-[0.7rem] text-[var(--highlight-text)] hover:opacity-80 transition-opacity font-medium"
              >
                Sync columns
              </button>
            )}
          </div>
          <textarea
            className={cn(
              "w-full min-h-[80px] bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 resize-y",
              "text-[var(--text)] text-sm font-mono placeholder:text-[var(--text-3)]",
              "outline-none focus:border-[var(--highlight)] transition-colors"
            )}
            placeholder="Hi {{name}}, your interview is on {{date}}."
            value={template}
            onChange={e => onTemplateChange(e.target.value)}
          />
          {vars.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {vars.map(v => (
                <span key={v} className="px-2 py-0.5 rounded-full bg-[var(--highlight)] text-[var(--highlight-fg)] text-[0.65rem] font-bold">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generated outputs — click to copy */}
        <div className="flex-1 overflow-y-auto">
          {template.trim() === "" ? (
            <p className="p-4 text-sm text-[var(--text-3)]">Write a template above to generate versions.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {previews.map((p, i) => {
                const empty = !Object.values(rows[i] ?? {}).some(v => v.trim())
                if (empty) return null
                return (
                  <button
                    key={i}
                    onClick={() => clickCopy(i)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors group",
                      justCopied === i
                        ? "bg-[var(--highlight)]/20"
                        : "hover:bg-[var(--bg-2)]"
                    )}
                  >
                    <span className="text-[0.6rem] font-mono text-[var(--text-3)] mt-1 shrink-0 w-4 text-right">{i + 1}</span>
                    <span className="text-sm text-[var(--text)] leading-relaxed flex-1">{p}</span>
                    <span className={cn(
                      "text-[0.65rem] shrink-0 mt-0.5 transition-all",
                      justCopied === i ? "text-green-400" : "text-[var(--text-3)] opacity-0 group-hover:opacity-100"
                    )}>
                      {justCopied === i ? "Copied!" : "Copy"}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: variable columns */}
      <div className="w-64 shrink-0 flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-2)]">
          <span className="label-xs">
            {varCols.length > 0 ? "Column data" : "No columns synced yet"}
          </span>
        </div>

        {varCols.length === 0 ? (
          <p className="p-3 text-[0.75rem] text-[var(--text-3)] leading-relaxed">
            Use <span className="font-mono">{"{{variable}}"}</span> in your template, then click Sync columns to create them.
          </p>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }} data-table-id={TABLE_ID}>
              <thead>
                <tr>
                  {varCols.map(col => (
                    <th
                      key={col.id}
                      className="border-r border-b border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-left"
                      style={{ width: `${100 / varCols.length}%` }}
                    >
                      <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {varCols.map((col, ci) => (
                      <td key={col.id} className="border-r border-b border-[var(--border)] p-0">
                        <input
                          className="w-full h-7 px-2 bg-transparent text-[var(--text)] text-sm outline-none focus:bg-[var(--bg-2)] focus:ring-1 focus:ring-[var(--highlight)] focus:ring-inset"
                          value={row[col.id] ?? ""}
                          onChange={e => setCell(ri, col.id, e.target.value)}
                          onPaste={e => onVarColPaste(e, ri, ci)}
                          onKeyDown={e => handleTableKeyDown(e, TABLE_ID, ri, ci, varCols.length, addRow, rows.length)}
                          data-row={ri}
                          data-col={ci}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
