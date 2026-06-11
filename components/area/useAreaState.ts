"use client"

import { useCallback, useEffect, useState } from "react"
import type { AreaState, Staff, PrefData, Worker } from "./types"
import { DEFAULT_STAFF } from "./types"

const STORAGE_KEY = "tim_area_v2"

function defaultState(): AreaState {
  const staff: Record<string, Staff> = {}
  for (const s of DEFAULT_STAFF) staff[s.id] = s
  return { staff, prefectures: {}, rosters: {} }
}

function load(): AreaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultState(), ...JSON.parse(raw) }
  } catch {}
  return defaultState()
}

export function useAreaState() {
  const [state, setState] = useState<AreaState>(defaultState)

  useEffect(() => {
    setState(load())
  }, [])

  const save = useCallback((next: AreaState) => {
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const assignPref = useCallback((pref: string, staffId: string) => {
    setState(prev => {
      const next = { ...prev, prefectures: { ...prev.prefectures, [pref]: { ...prev.prefectures[pref] ?? { count: 0 }, assignedTo: staffId } } }
      save(next)
      return next
    })
  }, [save])

  const addStaff = useCallback((staff: Staff) => {
    setState(prev => {
      const next = { ...prev, staff: { ...prev.staff, [staff.id]: staff } }
      save(next)
      return next
    })
  }, [save])

  const updateStaffNameJa = useCallback((id: string, nameJa: string) => {
    setState(prev => {
      if (!prev.staff[id]) return prev
      const next = { ...prev, staff: { ...prev.staff, [id]: { ...prev.staff[id], nameJa } } }
      save(next)
      return next
    })
  }, [save])

  const removeStaff = useCallback((id: string) => {
    setState(prev => {
      const staff = { ...prev.staff }
      delete staff[id]
      const prefectures = { ...prev.prefectures }
      for (const k of Object.keys(prefectures)) {
        if (prefectures[k].assignedTo === id) prefectures[k] = { ...prefectures[k], assignedTo: "unassigned" }
      }
      const next = { ...prev, staff, prefectures }
      save(next)
      return next
    })
  }, [save])

  const importCSV = useCallback((text: string) => {
    setState(prev => {
      const next = parseCSVIntoState(text, prev)
      save(next)
      return next
    })
  }, [save])

  const exportJSON = useCallback(() => {
    return JSON.stringify(state, null, 2)
  }, [state])

  const reset = useCallback(() => {
    const next = defaultState()
    save(next)
  }, [save])

  return { state, assignPref, addStaff, removeStaff, updateStaffNameJa, importCSV, exportJSON, reset }
}

// ── CSV parser (mirrors legacy format) ───────────────────────────────────────

function normalizePref(n: string) { return n.replace(/[都道府県]$/, "") }

function resolveStaff(name: string, staff: Record<string, Staff>): string {
  if (!name) return "unassigned"
  for (const [id, s] of Object.entries(staff)) {
    if (s.name === name || s.nameEn === name || id === name.toLowerCase()) return id
  }
  return "unassigned"
}

function parseDelimited(text: string): string[][] {
  const first = text.split("\n")[0]
  const tabs = (first.match(/\t/g) ?? []).length
  const commas = (first.match(/,/g) ?? []).length
  if (tabs > commas) {
    return text.split("\n").map(r => r.replace(/\r$/, "").split("\t").map(c => c.trim())).filter(r => r.some(c => c))
  }
  const rows: string[][] = []
  let row: string[] = [], cell = "", inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1]
    if (ch === '"' && inQ && nx === '"') { cell += '"'; i++ }
    else if (ch === '"') inQ = !inQ
    else if (ch === ',' && !inQ) { row.push(cell); cell = "" }
    else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && nx === '\n') i++
      row.push(cell)
      if (row.some(v => v.trim())) rows.push(row)
      row = []; cell = ""
    } else cell += ch
  }
  row.push(cell)
  if (row.some(v => v.trim())) rows.push(row)
  return rows
}

function parseCSVIntoState(text: string, prev: AreaState): AreaState {
  const rows = parseDelimited(text)
  if (rows.length < 2) return prev

  const headers = rows[0].map(h => h.replace(/^﻿/, "").trim())
  const col = (row: string[], name: string) => {
    const i = headers.indexOf(name)
    const v = i >= 0 ? (row[i] ?? "").trim() : ""
    return v === "#N/A" || v === "#REF!" ? "" : v
  }

  const newPrefectures: Record<string, PrefData> = { ...prev.prefectures }
  const newRosters: Record<string, Worker[]>     = { ...prev.rosters }
  const prefStaffVotes: Record<string, Record<string, number>> = {}

  for (let ri = 1; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row.some(c => c)) continue

    const area = normalizePref(col(row, "Area") || col(row, "エリア"))
    if (!area || area.startsWith("#")) continue

    const staffRaw = col(row, "Person in Charge") || col(row, "担当者")
    const staffId  = resolveStaff(staffRaw, prev.staff)

    // Count votes for dominant staff per prefecture
    if (!prefStaffVotes[area]) prefStaffVotes[area] = {}
    prefStaffVotes[area][staffId] = (prefStaffVotes[area][staffId] ?? 0) + 1

    const worker: Worker = {
      id:            col(row, "ID") || `w_${ri}`,
      name:          col(row, "Full Name") || col(row, "名前") || `Worker ${ri}`,
      furigana:      col(row, "Furigana") || col(row, "ふりがな"),
      gender:        col(row, "性別"),
      birthdate:     col(row, "Birthdate") || col(row, "生年月日"),
      moveInDate:    col(row, "Move-in Date"),
      firstWorkDate: col(row, "First Day of Work"),
      storeId:       col(row, "Store ID") || col(row, "店舗ID"),
      storeName:     col(row, "Name of assigned store") || col(row, "店舗名"),
      storeAddress:  col(row, "Store Address"),
      homeAddress:   col(row, "Employee Address"),
      apartment:     col(row, "Apartment Name"),
      phone:         col(row, "Phone Number"),
      status:        col(row, "Status"),
      assignedTo:    staffId,
    }

    if (!newRosters[area]) newRosters[area] = []
    // Deduplicate by id
    const existing = newRosters[area].findIndex(w => w.id === worker.id)
    if (existing >= 0) newRosters[area][existing] = worker
    else newRosters[area].push(worker)
  }

  // Apply dominant staff per prefecture
  for (const [area, votes] of Object.entries(prefStaffVotes)) {
    const dominant = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]
    newPrefectures[area] = {
      assignedTo: dominant,
      count: newRosters[area]?.length ?? 0,
    }
  }

  return { ...prev, prefectures: newPrefectures, rosters: newRosters }
}
