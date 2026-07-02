"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import {
  getTenpoStores,
  addTenpoStore,
  updateTenpoStore,
  deleteTenpoStore,
  type TenpoStore,
} from "@/app/actions/tenpo"

type EditableKey = keyof Omit<TenpoStore, "tenpo_cd">

const COLUMNS: { key: keyof TenpoStore; label: string; editable: boolean; wide?: boolean }[] = [
  { key: "tenpo_cd",   label: "店舗CD",    editable: false },
  { key: "tenpo_name", label: "店舗名",     editable: true, wide: true },
  { key: "zip",        label: "郵便番号",   editable: true },
  { key: "prefecture", label: "都道府県",   editable: true },
  { key: "address",    label: "住所",       editable: true, wide: true },
  { key: "tel",        label: "電話",       editable: true },
  { key: "area_cd",    label: "エリアCD",   editable: true },
  { key: "am",         label: "AM",         editable: true },
]

const inputCls =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]"

const EMPTY_NEW: TenpoStore = {
  tenpo_cd: "", tenpo_name: "", zip: "", prefecture: "", address: "", tel: "", area_cd: "", am: "",
}

export default function StoresTab() {
  const [stores, setStores] = useState<TenpoStore[] | null>(null)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<{ code: string; key: EditableKey } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [newStore, setNewStore] = useState<TenpoStore>(EMPTY_NEW)
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setStores(await getTenpoStores())
  }
  useEffect(() => {
    let alive = true
    getTenpoStores().then(d => { if (alive) setStores(d) })
    return () => { alive = false }
  }, [])

  function startEdit(code: string, key: EditableKey, current: string | null) {
    setEditing({ code, key }); setEditValue(current ?? "")
  }

  async function commitEdit() {
    if (!editing) return
    const { code, key } = editing
    const val = editValue.trim() || null
    const prev = stores ?? []
    setStores(prev.map(s => (s.tenpo_cd === code ? { ...s, [key]: val } : s)))
    setEditing(null)
    const res = await updateTenpoStore(code, { [key]: val })
    if ("error" in res) { setErr(res.error); load() }
  }

  async function saveNew() {
    setErr(null); setAdding(true)
    const res = await addTenpoStore({ ...newStore, tenpo_cd: newStore.tenpo_cd.trim() })
    setAdding(false)
    if ("error" in res) { setErr(res.error); return }
    setNewStore(EMPTY_NEW); setShowAdd(false)
    load()
  }

  async function remove(code: string) {
    setConfirmDel(null)
    setStores((stores ?? []).filter(s => s.tenpo_cd !== code))
    const res = await deleteTenpoStore(code)
    if ("error" in res) { setErr(res.error); load() }
  }

  const filtered = (stores ?? []).filter(s => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [s.tenpo_cd, s.tenpo_name, s.address, s.prefecture].some(v => (v ?? "").toLowerCase().includes(q))
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            className="bg-[var(--bg-2)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] w-64 transition-colors"
            placeholder="店舗CD・店舗名・住所で検索…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-[0.75rem] text-[var(--text-3)]">
          {stores === null ? "…" : `${filtered.length} / ${stores.length} 店舗`}
        </span>
        <button
          onClick={() => { setShowAdd(a => !a); setErr(null) }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity font-medium"
        >
          <Icon name="add" size={14} />
          店舗を追加
        </button>
      </div>

      {err && <p className="text-[0.75rem] text-red-400">{err}</p>}

      {/* Add form */}
      {showAdd && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] p-3 flex flex-col gap-2">
          <p className="label-xs">新しい店舗</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {COLUMNS.map(c => (
              <label key={c.key} className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] text-[var(--text-3)]">{c.label}{c.key === "tenpo_cd" && " *"}</span>
                <input
                  className={inputCls}
                  value={newStore[c.key] ?? ""}
                  onChange={e => setNewStore(s => ({ ...s, [c.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setNewStore(EMPTY_NEW) }} className="px-3 py-1 rounded text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">キャンセル</button>
            <button
              onClick={saveNew}
              disabled={adding || !newStore.tenpo_cd.trim()}
              className="px-3 py-1 rounded text-[0.72rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {adding ? "追加中…" : "追加"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {stores === null ? (
        <p className="text-[0.8rem] text-[var(--text-3)] animate-pulse py-8 text-center">読み込み中…</p>
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="w-full text-[0.78rem] border-collapse">
            <thead className="sticky top-0">
              <tr className="border-b border-[var(--border)] bg-[var(--bg-2)] text-left">
                {COLUMNS.map(c => (
                  <th key={c.key} className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.tenpo_cd} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)]">
                  {COLUMNS.map(c => {
                    const isEditing = c.editable && editing?.code === s.tenpo_cd && editing?.key === c.key
                    return (
                      <td
                        key={c.key}
                        className={cn("px-3 py-1.5 align-top", c.wide ? "max-w-[280px]" : "whitespace-nowrap")}
                        onDoubleClick={() => c.editable && startEdit(s.tenpo_cd, c.key as EditableKey, s[c.key])}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className={inputCls}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => {
                              if (e.key === "Enter") { e.preventDefault(); commitEdit() }
                              else if (e.key === "Escape") { e.preventDefault(); setEditing(null) }
                            }}
                          />
                        ) : (
                          <span
                            className={cn(
                              c.key === "tenpo_cd" ? "font-mono text-[var(--text)]" : "text-[var(--text-2)]",
                              c.wide && "block truncate",
                              c.editable && "cursor-text"
                            )}
                          >
                            {s[c.key] || <span className="text-[var(--text-3)]">—</span>}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 whitespace-nowrap text-right">
                    {confirmDel === s.tenpo_cd ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button onClick={() => remove(s.tenpo_cd)} className="text-[0.68rem] text-red-400 hover:text-red-300">削除</button>
                        <button onClick={() => setConfirmDel(null)} className="text-[0.68rem] text-[var(--text-3)] hover:text-[var(--text)]">取消</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDel(s.tenpo_cd)} className="text-[var(--text-3)] hover:text-red-400 transition-colors">
                        <Icon name="delete" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-[0.8rem] text-[var(--text-3)]">
                  {search ? "該当する店舗がありません。" : "店舗がまだありません。"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[0.7rem] text-[var(--text-3)]">セルをダブルクリックで編集できます（店舗CDは変更不可）。</p>
    </div>
  )
}
