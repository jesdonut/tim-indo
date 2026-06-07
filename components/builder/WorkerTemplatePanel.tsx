"use client"

import { useEffect, useRef, useState } from "react"
import { extractVars } from "./templateUtils"
import { cn } from "@/lib/cn"
import { getWorkers, type Worker } from "@/app/actions/workers"
import { Icon } from "@/components/Icon"

const LS_TEMPLATE = "builder_worker_template"

const DEFAULT_TEMPLATE = `{{worker_id}}\t{{name_latin}}\t{{name_kana}}
サポート担当：\t{{support_staff}}

店舗番号：{{store_code}}
店舗名：{{store_name}}
店舗住所：{{store_postal_code}}\t{{store_address}}
店舗電話：{{store_phone}}

初出勤日：{{first_work_date}}
出勤ルート：{{commute_route_url}}

住居名：{{housing_building}}
住居住所：{{housing_postal_code}}\t{{housing_address}}
部屋番号：{{housing_room}}
パスコード：{{housing_passcode}}

携帯電話：{{mobile_phone}}
ガス立ち会い：{{gas_appointment}}
特記事項：{{notes}}`

function workerToRecord(w: Worker): Record<string, string> {
  return Object.fromEntries(
    Object.entries(w)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)])
  )
}

function applyWorkerTemplate(template: string, w: Worker): string {
  const record = workerToRecord(w)
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => record[key] ?? "")
}

export default function WorkerTemplatePanel() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [selected, setSelected] = useState<Worker[]>([])
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [search, setSearch] = useState("")
  const [justCopied, setJustCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(LS_TEMPLATE)
    if (saved) setTemplate(saved)
    getWorkers().then(w => { setWorkers(w); setLoading(false) })
  }, [])

  function updateTemplate(t: string) {
    setTemplate(t)
    localStorage.setItem(LS_TEMPLATE, t)
  }

  function toggleWorker(w: Worker) {
    setSelected(prev =>
      prev.some(s => s.id === w.id) ? prev.filter(s => s.id !== w.id) : [...prev, w]
    )
  }

  function removeSelected(id: string) {
    setSelected(prev => prev.filter(s => s.id !== id))
  }

  const vars = extractVars(template)

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      (w.worker_id ?? "").toLowerCase().includes(q) ||
      (w.name_latin ?? "").toLowerCase().includes(q) ||
      (w.name_kana ?? "").toLowerCase().includes(q) ||
      (w.nickname ?? "").toLowerCase().includes(q)
    )
  })

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setJustCopied(id)
    setTimeout(() => setJustCopied(null), 1200)
  }

  async function copyAll() {
    const all = selected.map(w => applyWorkerTemplate(template, w)).join("\n\n---\n\n")
    await navigator.clipboard.writeText(all)
    setJustCopied("__all__")
    setTimeout(() => setJustCopied(null), 1200)
  }

  return (
    <div className="flex h-full min-h-0">

      {/* LEFT: template + outputs */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-[var(--border)]">

        {/* Template editor */}
        <div className="flex flex-col gap-2 p-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="label-xs">Template</span>
            <button
              onClick={() => { updateTemplate(DEFAULT_TEMPLATE) }}
              className="text-[0.68rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              Reset to default
            </button>
          </div>
          <textarea
            className="w-full min-h-[120px] bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 resize-y text-[var(--text)] text-sm font-mono placeholder:text-[var(--text-3)] outline-none focus:border-[var(--highlight-text)] transition-colors"
            value={template}
            onChange={e => updateTemplate(e.target.value)}
          />
          {vars.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {vars.map(v => (
                <span key={v} className="px-1.5 py-0.5 rounded-full bg-[var(--highlight)] text-[var(--highlight-fg)] text-[0.6rem] font-bold font-mono">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Outputs */}
        <div className="flex-1 overflow-y-auto">
          {selected.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-3)]">Select workers on the right to generate outputs.</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
                <span className="text-[0.72rem] text-[var(--text-3)]">{selected.length} worker{selected.length > 1 ? "s" : ""}</span>
                <button
                  onClick={copyAll}
                  className={cn("text-[0.72rem] font-medium transition-all", justCopied === "__all__" ? "text-green-400" : "text-[var(--text-2)] hover:text-[var(--text)]")}
                >
                  {justCopied === "__all__" ? "Copied all!" : "Copy all"}
                </button>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {selected.map(w => {
                  const output = applyWorkerTemplate(template, w)
                  return (
                    <button
                      key={w.id}
                      onClick={() => copy(w.id, output)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors group",
                        justCopied === w.id ? "bg-[var(--highlight)]/20" : "hover:bg-[var(--bg-2)]"
                      )}
                    >
                      <span className="text-[0.65rem] text-[var(--text-3)] font-mono mt-0.5 shrink-0 w-8">{w.worker_id ?? "—"}</span>
                      <span className="text-[0.78rem] text-[var(--text)] leading-relaxed flex-1 whitespace-pre-wrap">{output}</span>
                      <span className={cn("text-[0.65rem] shrink-0 mt-0.5 transition-all", justCopied === w.id ? "text-green-400" : "text-[var(--text-3)] opacity-0 group-hover:opacity-100")}>
                        {justCopied === w.id ? "Copied!" : "Copy"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT: worker search + selection */}
      <div className="w-72 shrink-0 flex flex-col">

        {/* Search */}
        <div className="p-2 border-b border-[var(--border)]">
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded pl-7 pr-3 py-1.5 text-[0.75rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
              placeholder="Search workers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {selected.length > 0 && (
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className="text-[0.68rem] text-[var(--text-3)]">{selected.length} selected</span>
              <button onClick={() => setSelected([])} className="text-[0.68rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">Clear</button>
            </div>
          )}
        </div>

        {/* Worker list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-[0.75rem] text-[var(--text-3)]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-[0.75rem] text-[var(--text-3)]">No workers found.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map(w => {
                const isSelected = selected.some(s => s.id === w.id)
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWorker(w)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-2 transition-colors",
                      isSelected ? "bg-[var(--highlight)]/10" : "hover:bg-[var(--bg-2)]"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors",
                      isSelected ? "bg-[var(--text)] border-[var(--text)]" : "border-[var(--border)]"
                    )}>
                      {isSelected && <Icon name="check" size={11} className="text-[var(--bg)]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.68rem] font-mono text-[var(--text-3)]">{w.worker_id ?? "—"}</span>
                        <span className="text-[0.75rem] text-[var(--text)] font-medium truncate">{w.name_latin ?? w.name_kana ?? "—"}</span>
                      </div>
                      <span className="text-[0.68rem] text-[var(--text-3)] truncate block">{w.store_name ?? ""}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
