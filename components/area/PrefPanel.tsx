"use client"

import { useState } from "react"
import type { AreaState, Worker } from "./types"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"

type Props = {
  pref: string
  state: AreaState
  onAssign: (pref: string, staffId: string) => void
  onClose: () => void
}

function calcAge(birthdate?: string): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate)
  if (isNaN(b.getTime())) return null
  const t = new Date()
  let age = t.getFullYear() - b.getFullYear()
  if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--
  return age >= 0 ? age : 0
}

function tenureMonths(dateStr?: string): number | null {
  if (!dateStr) return null
  const s = new Date(dateStr)
  if (isNaN(s.getTime())) return null
  const t = new Date()
  return Math.floor((t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth()))
}

export default function PrefPanel({ pref, state, onAssign, onClose }: Props) {
  const [tab, setTab] = useState<"workers" | "edit">("workers")

  const data    = state.prefectures[pref]
  const roster  = state.rosters[pref] ?? []
  const staff   = Object.values(state.staff)
  const current = data?.assignedTo ?? "unassigned"
  const currentStaff = state.staff[current]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          {currentStaff && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentStaff.color }} />
          )}
          <h2 className="font-bold text-[var(--text)]">{pref}</h2>
          <span className="text-xs text-[var(--text-3)]">{roster.length}名</span>
        </div>
        <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors flex items-center"><Icon name="close" size={18} /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] shrink-0">
        {(["workers", "edit"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-[0.72rem] font-medium transition-colors",
              tab === t ? "text-[var(--text)] border-b-2 border-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            )}
          >
            {t === "workers" ? "人材" : "担当者設定"}
          </button>
        ))}
      </div>

      {/* Workers tab */}
      {tab === "workers" && (
        <div className="flex-1 overflow-y-auto">
          {roster.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-3)] text-center">データなし</p>
          ) : (
            <div className="divide-y divide-[var(--border-soft)]">
              {roster.map((w, i) => {
                const age = calcAge(w.birthdate)
                const wm  = tenureMonths(w.firstWorkDate)
                const mm  = tenureMonths(w.moveInDate)
                return (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--text)]">{w.name}</span>
                      <span className="text-[0.65rem] text-[var(--text-3)] shrink-0">
                        {age !== null ? `${age}歳` : ""}{w.gender ? ` · ${w.gender}` : ""}
                      </span>
                    </div>
                    {w.furigana && <p className="text-[0.65rem] text-[var(--text-3)]">{w.furigana}</p>}
                    {w.storeName && <p className="text-[0.7rem] text-[var(--text-2)] mt-0.5 truncate flex items-center gap-0.5"><Icon name="store" size={11} />{w.storeName}</p>}
                    <div className="flex gap-3 mt-0.5">
                      {wm !== null && <span className="text-[0.6rem] text-[var(--text-3)] flex items-center gap-0.5">勤務 {wm}ヶ月{wm > 0 && wm % 4 === 0 ? <Icon name="warning" size={10} /> : null}</span>}
                      {mm !== null && <span className={cn("text-[0.6rem] flex items-center gap-0.5", mm >= 10 ? "text-amber-500" : "text-[var(--text-3)]")}>入居 {mm}ヶ月{mm >= 10 ? <Icon name="warning" size={10} /> : null}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit tab */}
      {tab === "edit" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          <p className="label-xs mb-1">担当者を選択</p>
          {[...staff, { id: "unassigned", name: "未割当", nameEn: "Unassigned", color: "#94a3b8" }].map(s => (
            <button
              key={s.id}
              onClick={() => onAssign(pref, s.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded border text-left transition-all",
                current === s.id
                  ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
                  : "border-[var(--border)] hover:border-[var(--text-2)] text-[var(--text)]"
              )}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border-2"
                style={{ background: s.color, borderColor: current === s.id ? "rgba(255,255,255,0.4)" : s.color }}
              />
              <span className="text-sm font-medium">{s.name}</span>
              {s.nameEn !== s.name && <span className={cn("text-xs ml-auto", current === s.id ? "opacity-60" : "text-[var(--text-3)]")}>{s.nameEn}</span>}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
