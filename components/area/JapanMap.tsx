"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as topojson from "topojson-client"
import { geoMercator, geoPath } from "d3"
import type { MapMode, AreaState, Staff } from "./types"
import { MAX_CAPACITY } from "./types"

const MAP_W = 800
const MAP_H = 900

type MapFeature = { name: string; path: string }

function normalizePref(n: string) { return n?.replace(/[都道府県]$/, "") ?? "" }

function workerCount(pref: string, state: AreaState): number {
  return state.rosters[pref]?.length ?? state.prefectures[pref]?.count ?? 0
}

function staffColor(pref: string, state: AreaState, staffColors: Map<string, string>): string {
  const id = state.prefectures[pref]?.assignedTo
  if (!id || id === "unassigned") return "#e2e0db"
  return staffColors.get(id) ?? "#e2e0db"
}

function countColor(count: number, max: number): string {
  if (!count || !max) return "#e2e0db"
  const t = Math.min(count / max, 1)
  const r = Math.round(237 + (var_highlight_r - 237) * t)
  const g = Math.round(233 + (var_highlight_g - 233) * t)
  const b = Math.round(225 + (var_highlight_b - 225) * t)
  return `rgb(${r},${g},${b})`
}

// Approx highlight orange for gradient
const var_highlight_r = 237, var_highlight_g = 122, var_highlight_b = 91

type Props = {
  state: AreaState
  mode: MapMode
  selectedPref: string | null
  searchMatches: Set<string>
  onSelectPref: (pref: string) => void
}

export default function JapanMap({ state, mode, selectedPref, searchMatches, onSelectPref }: Props) {
  const [topoData, setTopoData] = useState<object | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging]   = useState(false)
  const dragRef  = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    fetch("/maps/japan.topojson").then(r => r.json()).then(setTopoData).catch(console.error)
  }, [])

  const { features, vb } = useMemo<{ features: MapFeature[]; vb: { x: number; y: number; w: number; h: number } }>(() => {
    const fallback = { x: 0, y: 0, w: MAP_W, h: MAP_H }
    if (!topoData) return { features: [], vb: fallback }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = topoData as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col  = (topojson.feature as any)(topo, topo.objects.japan) as any
    const proj = geoMercator().fitSize([MAP_W, MAP_H], col)
    const gen  = geoPath(proj)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats = col.features.map((f: any) => ({
      name: normalizePref(f.properties.nam_ja as string),
      path: gen(f) ?? "",
    }))
    // Tight bounds around the actual landmass so the SVG has no empty ocean
    // letterboxing — the map fills its container and stays visually centered
    // instead of leaning to one side.
    const [[x0, y0], [x1, y1]] = gen.bounds(col)
    const pad = 8
    return {
      features: feats,
      vb: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 },
    }
  }, [topoData])

  const staffColors = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of Object.values(state.staff)) m.set(s.id, s.color)
    return m
  }, [state.staff])

  const maxCount = useMemo(() => {
    let m = 0
    for (const pref of features) {
      const c = workerCount(pref.name, state)
      if (c > m) m = c
    }
    return m
  }, [features, state])

  function getFill(pref: string): string {
    const count = workerCount(pref, state)
    if (mode === "staff") return staffColor(pref, state, staffColors)
    if (mode === "count") return countColor(count, maxCount)
    if (mode === "unassigned") {
      if (!count) return "#e2e0db"
      const id = state.prefectures[pref]?.assignedTo
      return (!id || id === "unassigned") ? "#fca5a5" : "#86efac"
    }
    return "#e2e0db"
  }

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    dragRef.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y }
    movedRef.current = false
    setDragging(true)
  }
  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.mx
    const dy = e.clientY - dragRef.current.my
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    setTransform(prev => ({
      ...prev,
      x: dragRef.current!.tx + dx * (vb.w / rect.width),
      y: dragRef.current!.ty + dy * (vb.h / rect.height),
    }))
  }
  function onMouseUp() { dragRef.current = null; setDragging(false) }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.85 : 1.18
    const newScale = Math.max(0.5, Math.min(10, transform.scale * factor))
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = vb.x + ((e.clientX - rect.left) / rect.width) * vb.w
    const vy = vb.y + ((e.clientY - rect.top) / rect.height) * vb.h
    const mx = (vx - transform.x) / transform.scale
    const my = (vy - transform.y) / transform.scale
    setTransform({ x: vx - mx * newScale, y: vy - my * newScale, scale: newScale })
  }

  function zoom(factor: number) {
    setTransform(prev => {
      const s = Math.max(0.5, Math.min(10, prev.scale * factor))
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2
      const mx = (cx - prev.x) / prev.scale
      const my = (cy - prev.y) / prev.scale
      return { x: cx - mx * s, y: cy - my * s, scale: s }
    })
  }

  if (!topoData) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-3)]">
        地図を読み込み中...
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-[var(--bg-2)]">
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full h-full select-none"
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {features.map(f => {
            const isSelected = f.name === selectedPref
            const hasSearch  = searchMatches.size > 0
            const isMatch    = searchMatches.has(f.name)
            const isDimmed   = hasSearch && !isMatch
            const fill       = getFill(f.name)

            return (
              <path
                key={f.name}
                d={f.path}
                fill={isDimmed ? "#d1cec8" : fill}
                stroke={isSelected ? "var(--highlight)" : isMatch ? "var(--highlight)" : "#fff"}
                strokeWidth={isSelected ? 1.5 : isMatch ? 1 : 0.3}
                vectorEffect="non-scaling-stroke"
                style={{ opacity: isDimmed ? 0.3 : 1, cursor: "pointer", transition: "opacity 0.15s, fill 0.2s" }}
                onClick={() => {
                  if (movedRef.current) return
                  onSelectPref(f.name)
                }}
              >
                <title>{f.name} · {workerCount(f.name, state)}名</title>
              </path>
            )
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        {[{ label: "+", fn: () => zoom(1.3) }, { label: "−", fn: () => zoom(0.77) }, { label: "⊙", fn: () => setTransform({ x: 0, y: 0, scale: 1 }) }].map(b => (
          <button
            key={b.label}
            onClick={b.fn}
            className="w-8 h-8 rounded border border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors flex items-center justify-center"
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Summary pill */}
      <div className="absolute top-3 left-3 rounded border border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur px-3 py-1.5">
        <p className="text-[0.68rem] text-[var(--text-2)]">
          <span className="font-bold text-[var(--text)]">{Object.keys(state.prefectures).length}</span> 都道府県
          <span className="mx-2 text-[var(--text-3)]">·</span>
          <span className="font-bold text-[var(--text)]">{Object.values(state.rosters).reduce((s, r) => s + r.length, 0)}</span> 名
        </p>
      </div>
    </div>
  )
}
