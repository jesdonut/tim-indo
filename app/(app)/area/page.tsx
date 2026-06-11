"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAreaState } from "@/components/area/useAreaState"
import JapanMap from "@/components/area/JapanMap"
import StaffCards from "@/components/area/StaffCards"
import PrefPanel from "@/components/area/PrefPanel"
import { cn } from "@/lib/cn"
import type { MapMode, AreaState, PrefData, Worker as AreaWorker } from "@/components/area/types"
import { MODE_LABELS, EXTRA_COLORS } from "@/components/area/types"
import { PageHeader, PillTabs, ToolContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import { getTeamData, getAreaNameJa, setAreaNameJa } from "@/app/actions/teams"
import { getWorkers, type Worker } from "@/app/actions/workers"
import PixelLoader from "@/components/PixelLoader"

const MODES: MapMode[] = ["staff", "count", "unassigned"]

// Stable colors per position in the team list
const SEED_COLORS = ["#be185d", "#0891b2", "#65a30d", ...EXTRA_COLORS]

// Match a support_staff string to a staff id — checks English name, Japanese name, and first-name prefixes
function matchStaffId(supportStaff: string | null | undefined, staffMap: Record<string, { name: string; nameEn: string; nameJa?: string }>): string | null {
  if (!supportStaff) return null
  const q = supportStaff.trim().toLowerCase()
  for (const [id, s] of Object.entries(staffMap)) {
    const candidates = [s.name, s.nameEn, s.nameJa ?? ""].filter(Boolean).map(n => n.toLowerCase())
    if (candidates.some(c => c === q || c.startsWith(q) || q.startsWith(c))) return id
  }
  return null
}

export default function AreaPage() {
  const { state, assignPref, addStaff, removeStaff, updateStaffNameJa, importCSV, exportJSON, reset } = useAreaState()

  const [mode,        setMode]        = useState<MapMode>("staff")
  const [selectedPref,setSelectedPref]= useState<string | null>(null)
  const [search,      setSearch]      = useState("")
  const [dbWorkers,   setDbWorkers]   = useState<Worker[]>([])
  const [dbNameJa,    setDbNameJa]    = useState<Record<string, string>>({})
  const [loading,     setLoading]     = useState(true)
  const csvRef = useRef<HTMLInputElement>(null)

  // Seed team members + apply DB nameJa mappings on every load
  useEffect(() => {
    Promise.all([getTeamData(), getAreaNameJa(), getWorkers()]).then(([teamData, nameJaMap, workers]) => {
      setDbWorkers(workers)
      setDbNameJa(nameJaMap)

      if (teamData?.profiles?.length) {
        teamData.profiles.forEach((profile, i) => {
          const name = profile.name ?? "Team member"
          addStaff({
            id: profile.id,
            name,
            nameEn: name,
            nameJa: nameJaMap[profile.id] ?? "",
            color: SEED_COLORS[i % SEED_COLORS.length],
          })
        })
      }

      // Apply nameJa to any staff already in state (e.g. loaded from localStorage)
      Object.entries(nameJaMap).forEach(([profileId, nameJa]) => {
        updateStaffNameJa(profileId, nameJa)
      })
    }).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute worker count per staff member from the DB (by support_staff name match)
  const dbCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of dbWorkers) {
      const id = matchStaffId(w.support_staff, state.staff)
      if (id) counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  }, [dbWorkers, state.staff])

  // Build prefectures + rosters from DB workers so the map works without a CSV import.
  // localStorage assignments take precedence (spread order: DB first, then state).
  const effectiveState = useMemo<AreaState>(() => {
    if (!dbWorkers.length) return state
    const prefectures: Record<string, PrefData> = {}
    const rosters: Record<string, AreaWorker[]> = {}
    const votes: Record<string, Record<string, number>> = {}
    for (const w of dbWorkers) {
      const area = w.area?.trim().replace(/[都道府県]$/, "")
      if (!area) continue
      const staffId = matchStaffId(w.support_staff, state.staff) ?? "unassigned"
      if (!votes[area]) votes[area] = {}
      votes[area][staffId] = (votes[area][staffId] ?? 0) + 1
      if (!rosters[area]) rosters[area] = []
      rosters[area].push({
        id: w.id,
        name: w.name_kana ?? w.name_latin ?? w.id,
        furigana: w.name_kana ?? undefined,
        gender: w.gender ?? undefined,
        birthdate: w.birth_date ?? undefined,
        moveInDate: w.move_in_date ?? undefined,
        firstWorkDate: w.first_work_date ?? undefined,
        storeId: w.store_code ?? undefined,
        storeName: w.store_name ?? undefined,
        storeAddress: w.store_address ?? undefined,
        homeAddress: w.housing_address ?? undefined,
        apartment: w.housing_building ?? undefined,
        phone: w.mobile_phone ?? undefined,
        status: w.status ?? undefined,
        assignedTo: staffId !== "unassigned" ? staffId : undefined,
      })
    }
    for (const [area, areaVotes] of Object.entries(votes)) {
      const dominant = Object.entries(areaVotes).sort((a, b) => b[1] - a[1])[0][0]
      prefectures[area] = { assignedTo: dominant, count: rosters[area]?.length ?? 0 }
    }
    return {
      ...state,
      prefectures: { ...prefectures, ...state.prefectures },
      rosters: { ...rosters, ...state.rosters },
    }
  }, [dbWorkers, state])

  const searchMatches = useMemo(() => {
    const q = search.trim()
    if (!q) return new Set<string>()
    const ql = q.toLowerCase()
    const hits = new Set<string>()
    // Match prefecture name
    for (const [pref] of Object.entries(effectiveState.prefectures)) {
      if (pref.includes(q)) hits.add(pref)
    }
    // Match workers
    for (const [pref, roster] of Object.entries(effectiveState.rosters)) {
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
    addStaff({ id, name, nameEn: name, nameJa: "", color })
  }

  function handleUpdateNameJa(profileId: string, nameJa: string) {
    updateStaffNameJa(profileId, nameJa)
    setAreaNameJa(profileId, nameJa)  // persist to DB for cross-device sync
  }

  if (loading) return (
    <div className="relative h-[calc(100dvh-48px)]"><PixelLoader /></div>
  )

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
            onUpdateNameJa={handleUpdateNameJa}
          />
        </div>

        {/* Map */}
        <JapanMap
          state={effectiveState}
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
              state={effectiveState}
              onAssign={(pref, staffId) => assignPref(pref, staffId)}
              onClose={() => setSelectedPref(null)}
            />
          </div>
        )}

      </ToolContent>
    </div>
  )
}
