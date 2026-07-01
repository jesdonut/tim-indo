"use client"

import { useState, useTransition } from "react"
import { lookupTrainLine, type LineInfo } from "@/app/actions/maps"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"

// ── Train company lookup ──────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  "JR":         "bg-green-500/15 text-green-600 dark:text-green-400",
  "JR新幹線":   "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "地下鉄":     "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  "私鉄":       "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "新交通":     "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "モノレール": "bg-pink-500/15 text-pink-600 dark:text-pink-400",
}

function TrainLookup() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LineInfo[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleChange(val: string) {
    setQuery(val)
    startTransition(async () => {
      const r = await lookupTrainLine(val)
      setResults(r)
    })
  }

  async function copyLine(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-6">
        <p className="label-xs mb-1">鉄道会社</p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Train company finder</h1>
      </div>

      <input
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
        placeholder="e.g. 山手線, Yamanote, 銀座線, Tokyo Metro…"
        value={query}
        onChange={e => handleChange(e.target.value)}
        autoFocus
      />

      {!query.trim() && (
        <p className="text-[0.72rem] text-[var(--text-3)]">
          Type a line name or operator to find the company — then copy to paste into the okurikomi sheet.
        </p>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-[0.75rem] text-[var(--text-3)]">No lines found.</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((r, i) => {
            const copyText = `${r.line}（${r.operator} / ${r.operatorEn}）`
            const key = `${i}`
            return (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded bg-[var(--bg-2)]">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[0.6rem] font-bold px-1.5 py-0.5 rounded shrink-0",
                    TYPE_COLOR[r.type] ?? "bg-[var(--bg)] text-[var(--text-3)]")}>
                    {r.type}
                  </span>
                  <span className="text-sm font-medium text-[var(--text)]">{r.line}</span>
                  <span className="text-[0.75rem] text-[var(--text-2)]">{r.operator}</span>
                  <span className="text-[0.68rem] text-[var(--text-3)]">({r.operatorEn})</span>
                </div>
                <button
                  onClick={() => copyLine(copyText, key)}
                  className={cn("shrink-0 text-[0.65rem] transition-all",
                    copied === key ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]")}
                >
                  {copied === key ? "Copied!" : "Copy"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  return (
    <>
      <PageHeader title="送り込みシート" />
      <PageContent>
        <TrainLookup />
      </PageContent>
    </>
  )
}
