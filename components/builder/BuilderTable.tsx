"use client"

import React, { useImperativeHandle, useRef, useState } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { parsePaste, applyTemplate } from "./templateUtils"
import { handleTableKeyDown } from "./useTableNav"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import type { ColDef, Row } from "./types"

const TABLE_ID = "builder-main"
const MIN_COL_W = 80
const DEFAULT_COL_W = 160

function computeCell(formula: string, row: Row, cols: ColDef[]): string {
  let result = formula
  cols.forEach(c => {
    const val = row[c.id] ?? ""
    result = result.replaceAll(`{{${c.id}}}`, val)
    result = result.replaceAll(`{{${c.label}}}`, val)
  })
  return result
}

function ColHeader({
  col, allCols, onFormulaChange, onRename, onDelete, onResizeStart, onCopyCol, onClearSel, selCount,
}: {
  col: ColDef
  allCols: ColDef[]
  onFormulaChange: (id: string, formula: string) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
  onResizeStart: (e: React.MouseEvent, id: string) => void
  onCopyCol: (id: string) => void
  onClearSel: (id: string) => void
  selCount: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id })

  const inputCols = allCols.filter(c => !c.computed)

  return (
    <th
      ref={setNodeRef}
      style={{ width: col.width, minWidth: col.width, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn("relative border-r border-b border-[var(--border)] select-none", col.computed ? "bg-[var(--highlight)]/10" : "bg-[var(--bg-2)]")}
    >
      {col.computed ? (
        <div className="flex flex-col h-auto min-h-8 px-2 py-1 gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] font-bold text-[var(--highlight-text)] uppercase tracking-wider shrink-0">fx</span>
            <input
              className="flex-1 bg-transparent text-[0.72rem] font-mono text-[var(--text)] outline-none min-w-0 placeholder:text-[var(--text-3)]"
              value={col.label}
              onChange={e => onFormulaChange(col.id, e.target.value)}
              placeholder="{{col_a}}_{{col_b}}"
              title="Formula: use {{column_name}} to reference columns"
            />
            <button
              onClick={() => onCopyCol(col.id)}
              className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--highlight-text)] hover:border-[var(--highlight-text)] transition-colors"
              title={selCount > 0 ? `Copy ${selCount} selected row(s)` : "Copy all rows"}
            >
              <Icon name="content_copy" size={13} />
              {selCount > 0 && <span className="text-[0.6rem] font-medium">{selCount}</span>}
            </button>
            {selCount > 0 && (
              <button
                onClick={() => onClearSel(col.id)}
                className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                title="Clear selection"
              >
                <Icon name="close" size={11} />
              </button>
            )}
            <button
              onClick={() => onDelete(col.id)}
              className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {inputCols.map(c => (
              <button
                key={c.id}
                onClick={() => onFormulaChange(col.id, col.label + `{{${c.label}}}`)}
                className="text-[0.55rem] px-1 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--highlight-text)] hover:border-[var(--highlight-text)] transition-colors font-mono"
                title={`Insert {{${c.label}}}`}
              >
                {`{{${c.label}}}`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center h-8 px-2 gap-1">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-[var(--text-3)] hover:text-[var(--text-2)] shrink-0 flex items-center"
          >
            <Icon name="drag_indicator" size={15} />
          </span>
          <input
            className="flex-1 bg-transparent text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--text-2)] outline-none min-w-0"
            value={col.label}
            onChange={e => onRename(col.id, e.target.value)}
          />
          <button
            onClick={() => onDelete(col.id)}
            className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <div
        onMouseDown={e => onResizeStart(e, col.id)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--highlight)] transition-colors"
      />
    </th>
  )
}

type Props = {
  cols: ColDef[]
  rows: Row[]
  onChange: (cols: ColDef[], rows: Row[]) => void
}

export type BuilderTableHandle = {
  addCol: () => void
  addComputedCol: () => void
}

const BuilderTable = React.forwardRef<BuilderTableHandle, Props>(function BuilderTable({ cols, rows, onChange }, ref) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null)
  const [rowSel, setRowSel] = useState<Record<string, Set<number>>>({})

  function toggleRowSel(colId: string, rowIdx: number) {
    setRowSel(prev => {
      const cur = new Set(prev[colId] ?? [])
      if (cur.has(rowIdx)) cur.delete(rowIdx)
      else cur.add(rowIdx)
      return { ...prev, [colId]: new Set(cur) }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = cols.findIndex(c => c.id === active.id)
      const newIdx = cols.findIndex(c => c.id === over.id)
      onChange(arrayMove(cols, oldIdx, newIdx), rows)
    }
  }

  function onResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const col = cols.find(c => c.id === id)!
    resizeRef.current = { id, startX: e.clientX, startW: col.width }
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const newW = Math.max(MIN_COL_W, resizeRef.current.startW + ev.clientX - resizeRef.current.startX)
      onChange(cols.map(c => c.id === id ? { ...c, width: newW } : c), rows)
    }
    function onUp() {
      resizeRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function setCell(rowIdx: number, colId: string, value: string) {
    onChange(cols, rows.map((r, i) => i === rowIdx ? { ...r, [colId]: value } : r))
  }

  function onCellPaste(e: React.ClipboardEvent, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text/plain")
    if (!text.includes("\t") && !text.includes("\n")) return
    e.preventDefault()
    const grid = parsePaste(text)
    const nextRows = [...rows]
    grid.forEach((pasteRow, ri) => {
      const targetRow = rowIdx + ri
      while (nextRows.length <= targetRow) nextRows.push({})
      pasteRow.forEach((val, ci) => {
        const targetCol = cols[colIdx + ci]
        if (targetCol && !targetCol.computed)
          nextRows[targetRow] = { ...nextRows[targetRow], [targetCol.id]: val }
      })
    })
    onChange(cols, nextRows)
  }

  function addCol() {
    const id = `col_${Date.now()}`
    const letter = String.fromCharCode(65 + cols.filter(c => !c.computed).length)
    onChange([...cols, { id, label: letter, width: DEFAULT_COL_W }], rows)
  }

  function addComputedCol() {
    const id = `out_${Date.now()}`
    onChange([...cols, { id, label: "", width: 220, computed: true }], rows)
  }

  function deleteCol(id: string) {
    onChange(cols.filter(c => c.id !== id), rows.map(r => { const n = { ...r }; delete n[id]; return n }))
    setRowSel(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function renameCol(id: string, label: string) {
    onChange(cols.map(c => c.id === id ? { ...c, label } : c), rows)
  }

  function updateFormula(id: string, formula: string) {
    onChange(cols.map(c => c.id === id ? { ...c, label: formula } : c), rows)
  }

  function addRow() { onChange(cols, [...rows, {}]) }

  function deleteRow(i: number) {
    onChange(cols, rows.filter((_, idx) => idx !== i))
    setRowSel(prev => {
      const next: Record<string, Set<number>> = {}
      for (const [colId, sel] of Object.entries(prev)) {
        const newSel = new Set<number>()
        for (const idx of sel) { if (idx < i) newSel.add(idx); else if (idx > i) newSel.add(idx - 1) }
        next[colId] = newSel
      }
      return next
    })
  }

  function clearSel(id: string) {
    setRowSel(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function copyCol(id: string) {
    const col = cols.find(c => c.id === id)!
    const sel = rowSel[id]
    const values = rows
      .filter((_, i) => !sel?.size || sel.has(i))
      .map(r => col.computed ? computeCell(col.label, r, cols) : (r[id] ?? ""))
      .join("\n")
    await navigator.clipboard.writeText(values)
  }

  const inputCols = cols.filter(c => !c.computed)

  useImperativeHandle(ref, () => ({ addCol, addComputedCol }))

  return (
    <div className="w-full overflow-x-auto" data-table-id={TABLE_ID}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
          <thead>
            <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              <tr>
                <th className="w-8 border-r border-b border-[var(--border)] bg-[var(--bg-2)]" />
                {cols.map(col => (
                  <ColHeader
                    key={col.id}
                    col={col}
                    allCols={cols}
                    onFormulaChange={updateFormula}
                    onRename={renameCol}
                    onDelete={deleteCol}
                    onResizeStart={onResizeStart}
                    onCopyCol={copyCol}
                    onClearSel={clearSel}
                    selCount={rowSel[col.id]?.size ?? 0}
                  />
                ))}
                {/* Filler column — absorbs remaining width so the grid reaches the page edge */}
                <th className="border-b border-[var(--border)] bg-[var(--bg-2)]" />
              </tr>
            </SortableContext>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="group">
                <td className="w-8 border-r border-b border-[var(--border)] text-center text-[0.65rem] text-[var(--text-3)] bg-[var(--bg-2)] select-none">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{ri + 1}</span>
                    <button
                      onClick={() => deleteRow(ri)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 leading-none ml-0.5 flex items-center"
                    >
                      <Icon name="close" size={11} />
                    </button>
                  </div>
                </td>
                {cols.map((col, ci) => (
                  <td
                    key={col.id}
                    className={cn("border-r border-b border-[var(--border)] p-0", col.computed && "bg-[var(--highlight)]/5")}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.computed ? (
                      <div
                        className={cn(
                          "h-8 px-2 flex items-center cursor-pointer select-none transition-colors",
                          rowSel[col.id]?.has(ri)
                            ? "bg-[var(--highlight)]/25 text-[var(--highlight-text)]"
                            : "hover:bg-[var(--bg-2)]"
                        )}
                        onClick={() => toggleRowSel(col.id, ri)}
                        title="Click to toggle row for copy"
                      >
                        <div className="flex-1 text-sm font-mono truncate">
                          {col.label ? computeCell(col.label, row, cols) : ""}
                        </div>
                      </div>
                    ) : (
                      <input
                        className="w-full h-8 px-2 bg-transparent text-[var(--text)] text-sm outline-none focus:bg-[var(--bg-2)] focus:ring-1 focus:ring-[var(--highlight-text)] focus:ring-inset"
                        value={row[col.id] ?? ""}
                        onChange={e => setCell(ri, col.id, e.target.value)}
                        onPaste={e => onCellPaste(e, ri, ci)}
                        onKeyDown={e => handleTableKeyDown(e, TABLE_ID, ri, inputCols.indexOf(col), inputCols.length, addRow, rows.length)}
                        data-row={ri}
                        data-col={inputCols.indexOf(col)}
                      />
                    )}
                  </td>
                ))}
                {/* Filler cell — keeps row grid lines flush to the page edge */}
                <td className="border-b border-[var(--border)]" />
              </tr>
            ))}
            <tr>
              <td colSpan={cols.length + 2} className="border-b border-[var(--border)]">
                <button onClick={addRow} className="w-full h-7 text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors">
                  + Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </DndContext>
    </div>
  )
})

export default BuilderTable
