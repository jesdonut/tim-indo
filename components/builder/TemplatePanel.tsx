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
  const previews = rows
    .filter(r => Object.values(r).some(v => v.trim() !== ""))
    .map(r => applyTemplate(template, r))

  function syncColumns() {
    onSyncCols(vars)
  }

  async function copyAll() {
    await navigator.clipboard.writeText(previews.join("\n\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Template input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label-xs">Template</span>
          {vars.length > 0 && (
            <button
              onClick={syncColumns}
              className="text-[0.7rem] text-[var(--highlight)] hover:opacity-80 transition-opacity font-medium"
            >
              Sync columns from variables
            </button>
          )}
        </div>
        <textarea
          className={cn(
            "w-full min-h-[100px] bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
            "text-[var(--text)] text-sm font-mono placeholder:text-[var(--text-3)]",
            "outline-none focus:border-[var(--highlight)] transition-colors resize-y"
          )}
          placeholder={"Hi {{name}}, your interview is on {{date}}. See you then."}
          value={template}
          onChange={e => onTemplateChange(e.target.value)}
        />
        {vars.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {vars.map(v => (
              <span
                key={v}
                className="px-2 py-0.5 rounded-full bg-[var(--highlight)] text-[var(--highlight-fg)] text-[0.65rem] font-bold"
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="label-xs">{previews.length} version{previews.length !== 1 ? "s" : ""}</span>
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
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {previews.map((p, i) => (
              <div
                key={i}
                className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5 text-sm text-[var(--text)] leading-relaxed"
              >
                <span className="text-[0.6rem] text-[var(--text-3)] font-mono mr-2">{i + 1}</span>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
