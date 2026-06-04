"use client"

import { useRef, useState, useCallback } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { parsePaste } from "./templateUtils"
import { cn } from "@/lib/cn"
import type { ColDef, Row } from "./types"

const MIN_COL_W = 80
const DEFAULT_COL_W = 160

// ── Sortable column header ───────────────────────────────────────────────────
function ColHeader({
  col, onRename, onDelete, onResizeStart,
}: {
  col: ColDef
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
  onResizeStart: (e: React.MouseEvent, id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id })

  return (
    <th
      ref={setNodeRef}
      style={{
        width: col.width,
        minWidth: col.width,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="relative border-r border-b border-[var(--border)] bg-[var(--bg-2)] select-none"
    >
      <div className="flex items-center h-8 px-2 gap-1">
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-[var(--text-3)] hover:text-[var(--text-2)] text-xs shrink-0"
          title="Drag to reorder"
        >⠿</span>

        {/* Editable label */}
        <input
          className="flex-1 bg-transparent text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--text-2)] outline-none min-w-0"
          value={col.label}
          onChange={e => onRename(col.id, e.target.value)}
        />

        {/* Delete */}
        <button
          onClick={() => onDelete(col.id)}
          className="shrink-0 text-[var(--text-3)] hover:text-red-400 text-xs leading-none"
          title="Remove column"
        >×</button>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={e => onResizeStart(e, col.id)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--highlight)] transition-colors"
      />
    </th>
  )
}

// ── Main table ───────────────────────────────────────────────────────────────
type Props = {
  cols: ColDef[]
  rows: Row[]
  onChange: (cols: ColDef[], rows: Row[]) => void
}

export default function BuilderTable({ cols, rows, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null)

  // ── Column drag reorder
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = cols.findIndex(c => c.id === active.id)
      const newIdx = cols.findIndex(c => c.id === over.id)
      onChange(arrayMove(cols, oldIdx, newIdx), rows)
    }
  }

  // ── Column resize
  function onResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const col = cols.find(c => c.id === id)!
    resizeRef.current = { id, startX: e.clientX, startW: col.width }

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const delta = ev.clientX - resizeRef.current.startX
      const newW = Math.max(MIN_COL_W, resizeRef.current.startW + delta)
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

  // ── Cell edit
  function setCell(rowIdx: number, colId: string, value: string) {
    const next = rows.map((r, i) => i === rowIdx ? { ...r, [colId]: value } : r)
    onChange(cols, next)
  }

  // ── Paste into a cell (handles multi-cell Excel paste)
  function onCellPaste(e: React.ClipboardEvent, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text/plain")
    if (!text.includes("\t") && !text.includes("\n")) return // single cell, let default handle it
    e.preventDefault()
    const grid = parsePaste(text)
    const nextRows = [...rows]
    grid.forEach((pasteRow, ri) => {
      const targetRow = rowIdx + ri
      while (nextRows.length <= targetRow) nextRows.push({})
      pasteRow.forEach((val, ci) => {
        const targetCol = cols[colIdx + ci]
        if (targetCol) nextRows[targetRow] = { ...nextRows[targetRow], [targetCol.id]: val }
      })
    })
    onChange(cols, nextRows)
  }

  // ── Add column
  function addCol() {
    const id = `col_${Date.now()}`
    onChange([...cols, { id, label: `Column ${cols.length + 1}`, width: DEFAULT_COL_W }], rows)
  }

  // ── Delete column
  function deleteCol(id: string) {
    const nextCols = cols.filter(c => c.id !== id)
    const nextRows = rows.map(r => { const n = { ...r }; delete n[id]; return n })
    onChange(nextCols, nextRows)
  }

  // ── Rename column
  function renameCol(id: string, label: string) {
    onChange(cols.map(c => c.id === id ? { ...c, label } : c), rows)
  }

  // ── Add row
  function addRow() {
    onChange(cols, [...rows, {}])
  }

  // ── Delete row
  function deleteRow(i: number) {
    onChange(cols, rows.filter((_, idx) => idx !== i))
  }

  return (
    <div className="w-full overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed" }}>
          <thead>
            <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
              <tr>
                {/* Row number header */}
                <th className="w-8 border-r border-b border-[var(--border)] bg-[var(--bg-2)]" />
                {cols.map(col => (
                  <ColHeader
                    key={col.id}
                    col={col}
                    onRename={renameCol}
                    onDelete={deleteCol}
                    onResizeStart={onResizeStart}
                  />
                ))}
                {/* Add column button */}
                <th className="border-b border-[var(--border)] bg-[var(--bg-2)] w-10">
                  <button
                    onClick={addCol}
                    className="w-full h-8 text-[var(--text-3)] hover:text-[var(--highlight)] text-lg leading-none transition-colors"
                    title="Add column"
                  >+</button>
                </th>
              </tr>
            </SortableContext>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="group">
                {/* Row number */}
                <td className="w-8 border-r border-b border-[var(--border)] text-center text-[0.65rem] text-[var(--text-3)] bg-[var(--bg-2)] select-none">
                  <div className="flex items-center justify-center gap-0.5">
                    <span>{ri + 1}</span>
                    <button
                      onClick={() => deleteRow(ri)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 leading-none ml-0.5"
                    >×</button>
                  </div>
                </td>
                {cols.map((col, ci) => (
                  <td
                    key={col.id}
                    className="border-r border-b border-[var(--border)] p-0"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <input
                      className="w-full h-8 px-2 bg-transparent text-[var(--text)] text-sm outline-none focus:bg-[var(--bg-2)] focus:ring-1 focus:ring-[var(--highlight)] focus:ring-inset"
                      value={row[col.id] ?? ""}
                      onChange={e => setCell(ri, col.id, e.target.value)}
                      onPaste={e => onCellPaste(e, ri, ci)}
                    />
                  </td>
                ))}
                <td className="border-b border-[var(--border)]" />
              </tr>
            ))}
            {/* Add row */}
            <tr>
              <td
                colSpan={cols.length + 2}
                className="border-b border-[var(--border)]"
              >
                <button
                  onClick={addRow}
                  className="w-full h-7 text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors"
                >
                  + Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </DndContext>
    </div>
  )
}
