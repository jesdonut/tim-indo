"use client"

import { useState } from "react"
import BuilderTable from "@/components/builder/BuilderTable"
import TemplatePanel from "@/components/builder/TemplatePanel"
import { extractVars } from "@/components/builder/templateUtils"
import { cn } from "@/lib/cn"
import type { ColDef, Row } from "@/components/builder/types"

const DEFAULT_COLS: ColDef[] = [
  { id: "col_a", label: "A", width: 160 },
  { id: "col_b", label: "B", width: 160 },
  { id: "col_c", label: "C", width: 160 },
]

const DEFAULT_ROWS: Row[] = Array.from({ length: 5 }, () => ({}))

export default function BuilderPage() {
  const [cols, setCols] = useState<ColDef[]>(DEFAULT_COLS)
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS)
  const [template, setTemplate] = useState("")
  const [tab, setTab] = useState<"table" | "versions">("table")

  function handleChange(newCols: ColDef[], newRows: Row[]) {
    setCols(newCols)
    setRows(newRows)
  }

  // Called when user clicks "Sync columns from variables"
  function syncColsFromVars(vars: string[]) {
    const existingIds = new Set(cols.map(c => c.id))
    const toAdd = vars.filter(v => !existingIds.has(`var_${v}`))
    const newCols: ColDef[] = toAdd.map(v => ({
      id: `var_${v}`,
      label: v,
      width: 160,
    }))
    setCols(prev => [...prev.filter(c => !c.id.startsWith("var_")), ...newCols])
  }

  function clearAll() {
    setCols(DEFAULT_COLS)
    setRows(DEFAULT_ROWS)
    setTemplate("")
  }

  async function copyTable() {
    const header = cols.map(c => c.label).join("\t")
    const body = rows.map(r => cols.map(c => r[c.id] ?? "").join("\t")).join("\n")
    await navigator.clipboard.writeText(header + "\n" + body)
  }

  const hasTemplate = template.trim().length > 0 && extractVars(template).length > 0

  return (
    <div className="flex flex-col h-[calc(100dvh-48px)]">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-[var(--border)] bg-[var(--bg)] shrink-0">
        <span className="label-xs mr-2">Builder</span>

        {/* Tab toggle */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-2)] rounded p-0.5">
          {(["table", "versions"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1 rounded text-[0.72rem] font-medium transition-all",
                tab === t
                  ? "bg-[var(--text)] text-[var(--bg)]"
                  : "text-[var(--text-2)] hover:text-[var(--text)]"
              )}
            >
              {t === "table" ? "Table" : "Versions"}
              {t === "versions" && hasTemplate && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[var(--highlight)] inline-block" />
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copyTable}
            className="text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          >
            Copy table
          </button>
          <button
            onClick={clearAll}
            className="text-[0.72rem] text-[var(--text-2)] hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "table" ? (
          <BuilderTable cols={cols} rows={rows} onChange={handleChange} />
        ) : (
          <div className="p-4 max-w-2xl">
            <TemplatePanel
              template={template}
              cols={cols}
              rows={rows}
              onTemplateChange={setTemplate}
              onSyncCols={syncColsFromVars}
            />
          </div>
        )}
      </div>

    </div>
  )
}
