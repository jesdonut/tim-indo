"use client"

import { useState } from "react"
import type { AreaState } from "./types"
import { EXTRA_COLORS, MAX_CAPACITY } from "./types"
import { cn } from "@/lib/cn"

type Props = {
  state: AreaState
  onAdd: (name: string, color: string) => void
  onRemove: (id: string) => void
}

export default function StaffCards({ state, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")

  function countFor(staffId: string): number {
    let total = 0
    for (const [pref, roster] of Object.entries(state.rosters)) {
      for (const w of roster) {
        const wa = w.assignedTo ?? state.prefectures[pref]?.assignedTo
        if (wa === staffId) total++
      }
    }
    // Fallback: count-only prefectures
    for (const [pref, data] of Object.entries(state.prefectures)) {
      if (data.assignedTo !== staffId) continue
      if (!(state.rosters[pref] ?? []).length && data.count > 0) total += data.count
    }
    return total
  }

  function prefsFor(staffId: string): string[] {
    return Object.entries(state.prefectures)
      .filter(([, d]) => d.assignedTo === staffId)
      .map(([p]) => p)
  }

  function confirmAdd() {
    if (!newName.trim()) return
    const usedColors = Object.values(state.staff).map(s => s.color)
    const color = EXTRA_COLORS.find(c => !usedColors.includes(c)) ?? "#f97316"
    onAdd(newName.trim(), color)
    setNewName("")
    setAdding(false)
  }

  const staff = Object.values(state.staff)
  const totalWorkers = Object.values(state.rosters).reduce((s, r) => s + r.length, 0)

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {staff.map(s => {
        const count = countFor(s.id)
        const prefs = prefsFor(s.id)
        const pct   = Math.min((count / MAX_CAPACITY) * 100, 100)
        const over  = count > MAX_CAPACITY

        return (
          <div key={s.id} className="group border border-[var(--border)] rounded bg-[var(--surface)] px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-sm font-semibold text-[var(--text)] flex-1">{s.name}</span>
              <span className="text-[0.65rem] text-[var(--text-3)]">{s.nameEn}</span>
              <button
                onClick={() => onRemove(s.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-3)] hover:text-red-400 text-xs transition-all"
              >×</button>
            </div>
            <div className={cn("text-lg font-bold leading-none mb-1", over ? "text-red-400" : "text-[var(--text)]")}>
              {count}<span className="text-xs font-normal text-[var(--text-3)] ml-0.5">名</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-2)] overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: over ? "#f87171" : s.color }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6rem] text-[var(--text-3)]">{count} / {MAX_CAPACITY}{over ? " ⚠" : ""}</span>
              {prefs.length > 0 && (
                <span className="text-[0.6rem] text-[var(--text-3)] truncate max-w-[120px]">
                  {prefs.slice(0, 4).join(" · ")}{prefs.length > 4 ? `…+${prefs.length - 4}` : ""}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Unassigned count */}
      {totalWorkers > 0 && (
        <div className="border border-dashed border-[var(--border)] rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-2)]">未割当</span>
          </div>
        </div>
      )}

      {/* Add staff */}
      {adding ? (
        <div className="flex gap-1.5">
          <input
            className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text)]"
            placeholder="名前"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") setAdding(false) }}
            autoFocus
          />
          <button onClick={confirmAdd} className="px-2 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-xs font-medium">追加</button>
          <button onClick={() => setAdding(false)} className="px-2 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--text-2)]">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={staff.length >= 8}
          className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          + 担当者を追加
        </button>
      )}
    </div>
  )
}
