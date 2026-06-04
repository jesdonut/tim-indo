"use client"

import { useState } from "react"
import { extractVars, applyTemplate } from "./templateUtils"
import { cn } from "@/lib/cn"
import type { ColDef, Row } from "./types"

type Props = {
  template: string
  cols: ColDef[]
  rows: Row[]
  onTemplateChange: (t: string) => void
  onSyncCols: (vars: string[]) => void
}

export default function TemplatePanel({ template, cols, rows, onTemplateChange, onSyncCols }: Props) {
  const [copied, setCopied] = useState(false)

  const vars = extractVars(template)
  const inputCols = cols.filter(c => !c.computed)

  // Only rows that have at least one value
  const activeRows = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => Object.values(row).some(v => v.trim() !== ""))

  const previews = activeRows.map(({ row }) => applyTemplate(template, row))

  async function copyAll() {
    await navigator.clipboard.writeText(previews.join("\n\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function copyOne(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedOne(id)
    setTimeout(() => setCopiedOne(null), 1200)
  }

  const [copiedOne, setCopiedOne] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">

      {/* Template input — top bar */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="label-xs">Template</span>
          {vars.length > 0 && (
            <button
              onClick={() => onSyncCols(vars)}
              className="text-[0.7rem] text-[var(--highlight-text)] hover:opacity-80 transition-opacity font-medium"
            >
              Sync columns from variables
            </button>
          )}
        </div>
        <textarea
          className={cn(
            "w-full min-h-[80px] bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
            "text-[var(--text)] text-sm font-mono placeholder:text-[var(--text-3)]",
            "outline-none focus:border-[var(--highlight)] transition-colors resize-y"
          )}
          placeholder="Hi {{name}}, your interview is on {{date}}. See you then."
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

      {/* Side-by-side results */}
      {activeRows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* Header row */}
          <div className="grid border-b border-[var(--border)] bg-[var(--bg-2)]"
            style={{ gridTemplateColumns: `32px 1fr 1fr` }}>
            <div className="border-r border-[var(--border)]" />
            <div className="px-3 py-1.5 border-r border-[var(--border)]">
              <span className="label-xs">Source data</span>
            </div>
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="label-xs">{activeRows.length} version{activeRows.length !== 1 ? "s" : ""}</span>
              <button
                onClick={copyAll}
                className={cn(
                  "text-[0.7rem] font-medium transition-all",
                  copied ? "text-green-400" : "text-[var(--text-2)] hover:text-[var(--text)]"
                )}
              >
                {copied ? "Copied!" : "Copy all"}
              </button>
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {activeRows.map(({ row, idx }, i) => (
              <div
                key={idx}
                className="grid"
                style={{ gridTemplateColumns: `32px 1fr 1fr` }}
              >
                {/* Row number */}
                <div className="border-r border-[var(--border)] flex items-center justify-center text-[0.65rem] text-[var(--text-3)] font-mono bg-[var(--bg-2)]">
                  {idx + 1}
                </div>

                {/* Source values */}
                <div className="border-r border-[var(--border)] px-3 py-2.5 flex flex-col gap-1">
                  {inputCols.map(col => {
                    const val = row[col.id]
                    if (!val) return null
                    return (
                      <div key={col.id} className="flex items-baseline gap-1.5">
                        <span className="text-[0.6rem] font-bold text-[var(--text-3)] uppercase tracking-wide shrink-0">
                          {col.label}
                        </span>
                        <span className="text-sm text-[var(--text)] truncate">{val}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Generated output */}
                <div className="px-3 py-2.5 flex items-start justify-between gap-2 group">
                  <p className="text-sm text-[var(--text)] leading-relaxed flex-1">
                    {previews[i]}
                  </p>
                  <button
                    onClick={() => copyOne(previews[i], String(idx))}
                    className={cn(
                      "shrink-0 text-[0.65rem] opacity-0 group-hover:opacity-100 transition-all",
                      copiedOne === String(idx) ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    {copiedOne === String(idx) ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Empty state */}
      {activeRows.length === 0 && template.trim() && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-3)] text-sm">
          Fill in the Table tab to see versions here.
        </div>
      )}

    </div>
  )
}
