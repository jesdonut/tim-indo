import type { KeyboardEvent } from "react"

function focusCell(tableId: string, row: number, col: number) {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLInputElement>(
      `[data-table-id="${tableId}"] [data-row="${row}"][data-col="${col}"],` +
      `[data-table-id="${tableId}"][data-row="${row}"][data-col="${col}"]`
    ) ?? document.querySelector<HTMLInputElement>(
      `[data-row="${row}"][data-col="${col}"]`
    )
    target?.focus()
    target?.select()
  })
}

export function handleTableKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  tableId: string,
  rowIdx: number,
  colIdx: number,
  totalCols: number,
  addRow: () => void,
  totalRows: number,
) {
  if (e.key === "Enter") {
    e.preventDefault()
    const nextRow = rowIdx + 1
    if (nextRow >= totalRows) addRow()
    focusCell(tableId, nextRow, colIdx)
    return
  }

  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault()
    let nextRow = rowIdx
    let nextCol = colIdx + 1
    if (nextCol >= totalCols) { nextCol = 0; nextRow = rowIdx + 1 }
    if (nextRow >= totalRows) addRow()
    focusCell(tableId, nextRow, nextCol)
    return
  }

  if (e.key === "Tab" && e.shiftKey) {
    e.preventDefault()
    let nextRow = rowIdx
    let nextCol = colIdx - 1
    if (nextCol < 0) { nextCol = totalCols - 1; nextRow = rowIdx - 1 }
    if (nextRow < 0) return
    focusCell(tableId, nextRow, nextCol)
  }
}
