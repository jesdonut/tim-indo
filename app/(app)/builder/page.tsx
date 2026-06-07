"use client"

import { useRef, useState } from "react"
import BuilderTable, { type BuilderTableHandle } from "@/components/builder/BuilderTable"
import TemplatePanel from "@/components/builder/TemplatePanel"
import WorkerTemplatePanel from "@/components/builder/WorkerTemplatePanel"
import { extractVars } from "@/components/builder/templateUtils"
import { cn } from "@/lib/cn"
import type { ColDef, Row } from "@/components/builder/types"
import { PageHeader, PillTabs, ToolContent } from "@/components/PageHeader"

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
  const [tab, setTab] = useState<"table" | "versions" | "people">("table")
  const tableRef = useRef<BuilderTableHandle>(null)

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

      <PageHeader title="Builder" right={
        <div className="flex items-center gap-3">
          <PillTabs
            options={[
              { value: "table"    as const, label: "Table" },
              { value: "versions" as const, label: "Versions", dot: hasTemplate },
              { value: "people"   as const, label: "People" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <button onClick={() => tableRef.current?.addCol()}         className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">+ Column</button>
          <button onClick={() => tableRef.current?.addComputedCol()} className="text-[0.72rem] text-[var(--highlight-text)] hover:opacity-80 transition-opacity font-medium">+ Output column</button>
          <button onClick={copyTable} className="text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Copy table</button>
          <button onClick={clearAll}  className="text-[0.72rem] text-[var(--text-2)] hover:text-red-400 transition-colors">Clear</button>
        </div>
      } />

      <ToolContent className="overflow-auto">
        {tab === "table" ? (
          <BuilderTable ref={tableRef} cols={cols} rows={rows} onChange={handleChange} />
        ) : tab === "people" ? (
          <div className="h-full flex flex-col overflow-hidden">
            <WorkerTemplatePanel />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <TemplatePanel
              template={template}
              cols={cols}
              rows={rows}
              onTemplateChange={setTemplate}
              onSyncCols={syncColsFromVars}
              onRowsChange={r => handleChange(cols, r)}
            />
          </div>
        )}
      </ToolContent>

    </div>
  )
}
