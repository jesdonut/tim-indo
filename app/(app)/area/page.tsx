"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAreaState } from "@/components/area/useAreaState"
import JapanMap from "@/components/area/JapanMap"
import StaffCards from "@/components/area/StaffCards"
import PrefPanel from "@/components/area/PrefPanel"
import { cn } from "@/lib/cn"
import type { MapMode } from "@/components/area/types"
import { MODE_LABELS, EXTRA_COLORS } from "@/components/area/types"
import { PageHeader, PillTabs, ToolContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import { getTeamData } from "@/app/actions/teams"
import { getWorkers, type Worker } from "@/app/actions/workers"

const MODES: MapMode[] = ["staff", "count", "unassigned"]

// Stable colors per position in the team list
const SEED_COLORS = ["#be185d", "#0891b2", "#65a30d", ...EXTRA_COLORS]

// Match a support_staff string to a staff id by name (case-insensitive, first-name friendly)
function matchStaffId(supportStaff: string | null | undefined, staffMap: Record<string, { name: string; nameEn: string }>): string | null {
  if (!supportStaff) return null
  const q = supportStaff.trim().toLowerCase()
  for (const [id, s] of Object.entries(staffMap)) {
    if (
      s.name.toLowerCase() === q ||
      s.nameEn.toLowerCase() === q ||
      s.name.toLowerCase().startsWith(q) ||
      s.nameEn.toLowerCase().startsWith(q) ||
      q.startsWith(s.name.toLowerCase()) ||
      q.startsWith(s.nameEn.toLowerCase())
    ) return id
  }
  return null
}

export default function AreaPage() {
  const { state, assignPref, addStaff, removeStaff, importCSV, exportJSON, reset } = useAreaState()

  const [mode,        setMode]        = useState<MapMode>("staff")
  const [selectedPref,setSelectedPref]= useState<string | null>(null)
  const [search,      setSearch]      = useState("")
  const [dbWorkers,   setDbWorkers]   = useState<Worker[]>([])
  const csvRef = useRef<HTMLInputElement>(null)

  // Seed all team members as staff if the list is empty
  useEffect(() => {
    if (Object.keys(state.staff).length > 0) return
    getTeamData().then(data => {
      if (!data?.profiles?.length) return
      data.profiles.forEach((profile, i) => {
        const name = profile.name ?? "Team member"
        addStaff({
          id: profile.id,
          name,
          nameEn: name,
          color: SEED_COLORS[i % SEED_COLORS.length],
        })
      })
    })
  }, [state.staff, addStaff])

  // Fetch live worker counts from the People database
  useEffect(() => {
    getWorkers().then(setDbWorkers)
  }, [])

  // Compute worker count per staff member from the DB (by support_staff name match)
  const dbCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of dbWorkers) {
      const id = matchStaffId(w.support_staff, state.staff)
      if (id) counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  }, [dbWorkers, state.staff])

  const searchMatches = useMemo(() => {
    const q = search.trim()
    if (!q) return new Set<string>()
    const ql = q.toLowerCase()
    const hits = new Set<string>()
    // Match prefecture name
    for (const [pref] of Object.entries(state.prefectures)) {
      if (pref.includes(q)) hits.add(pref)
    }
    // Match workers
    for (const [pref, roster] of Object.entries(state.rosters)) {
      for (const w of roster) {
        if (
          w.name.toLowerCase().includes(ql) ||
          (w.furigana ?? "").toLowerCase().includes(ql) ||
          (w.storeId ?? "").toLowerCase().includes(ql) ||
          (w.storeName ?? "").toLowerCase().includes(ql)
        ) hits.add(pref)
      }
    }
    return hits
  }, [search, state])

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      importCSV(text)
    }
    reader.readAsText(file, "utf-8")
    e.target.value = ""
  }

  function handleExport() {
    const blob = new Blob([exportJSON()], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "area-data.json"; a.click()
    URL.revokeObjectURL(url)
  }

  function handleAddStaff(name: string, color: string) {
    const id = `staff_${Date.now()}`
    addStaff({ id, name, nameEn: name, color })
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-48px)]">

      <PageHeader title="Area" right={
        <div className="flex items-center gap-2">
          <PillTabs
            options={MODES.map(m => ({ value: m, label: MODE_LABELS[m] }))}
            value={mode}
            onChange={setMode}
          />
          <div className="relative">
            <input
              className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1 text-[0.72rem] text-[var(--text)] outline-none focus:border-[var(--text)] placeholder:text-[var(--text-3)] w-36 transition-colors"
              placeholder="名前・店舗で検索"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] flex items-center"><Icon name="close" size={12} /></button>}
          </div>
          <label className="text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer transition-colors">
            CSV<input ref={csvRef} type="file" accept=".csv,.tsv" className="hidden" onChange={handleCSV} />
          </label>
          <button onClick={handleExport} className="text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Export</button>
          <button onClick={reset}        className="text-[0.72rem] text-[var(--text-3)] hover:text-red-400 transition-colors">Reset</button>
        </div>
      } />

      <ToolContent className="flex-row overflow-hidden">

        {/* Staff sidebar */}
        <div className="w-52 shrink-0 border-r border-[var(--border)] overflow-y-auto p-3 flex flex-col gap-2">
          <span className="label-xs">担当者</span>
          <StaffCards
            state={state}
            dbCounts={dbCounts}
            onAdd={handleAddStaff}
            onRemove={removeStaff}
          />
        </div>

        {/* Map */}
        <JapanMap
          state={state}
          mode={mode}
          selectedPref={selectedPref}
          searchMatches={searchMatches}
          onSelectPref={p => setSelectedPref(prev => prev === p ? null : p)}
        />

        {/* Prefecture panel */}
        {selectedPref && (
          <div className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
            <PrefPanel
              pref={selectedPref}
              state={state}
              onAssign={(pref, staffId) => assignPref(pref, staffId)}
              onClose={() => setSelectedPref(null)}
            />
          </div>
        )}

      </ToolContent>
    </div>
  )
}
