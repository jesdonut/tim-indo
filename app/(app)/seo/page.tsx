"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"

// ─── Types ────────────────────────────────────────────────────────────────────

type Row = {
  keyword: string
  kd:     number | null
  yahoo:  number | null
  google: number | null
  status: "idle" | "loading" | "done" | "error"
}

// ─── HTML parser (runs in browser) ───────────────────────────────────────────

function parseAramaki(html: string): { yahoo: number | null; google: number | null } {
  // Strip scripts / styles / tags
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")

  let google: number | null = null
  let yahoo:  number | null = null

  const segs = text.split(/(?=(?:Google|グーグル|Yahoo|ヤフー))/i)
  for (const seg of segs) {
    const local = seg.slice(0, 120)
    const nums  = local.match(/\d[\d,]*/g)
      ?.map(n => parseInt(n.replace(/,/g, "")))
      .filter(n => n > 0)
    if (!nums?.length) continue
    if (/Google|グーグル/i.test(local) && google === null) google = nums[0]
    if (/Yahoo|ヤフー/i.test(local)   && yahoo  === null) yahoo  = nums[0]
  }
  return { google, yahoo }
}

// ─── Fetch via CORS proxy (client-side, avoids server IP blocks) ──────────────

const PROXIES = [
  (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
]

async function fetchAramaki(keyword: string): Promise<{ yahoo: number | null; google: number | null; error?: string }> {
  const targetUrl = `https://aramakijake.jp/keyword/?keyword=${encodeURIComponent(keyword)}`

  for (const makeProxy of PROXIES) {
    try {
      const res = await fetch(makeProxy(targetUrl), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const json = await res.json().catch(() => null)
      // allorigins wraps in { contents: "..." }, corsproxy returns raw text
      const html: string = json?.contents ?? await res.text()
      if (!html || html.length < 200) continue
      const result = parseAramaki(html)
      if (result.google !== null || result.yahoo !== null) return result
    } catch { /* try next proxy */ }
  }
  return { google: null, yahoo: null, error: "fetch_failed" }
}

// ─── Editable number cell ─────────────────────────────────────────────────────

function NumCell({
  value, onChange, loading, inputRef,
}: {
  value: number | null
  onChange: (v: number | null) => void
  loading?: boolean
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  const [focused, setFocused] = useState(false)
  if (loading) return (
    <div className="flex justify-end pr-1">
      <span className="w-3.5 h-3.5 border border-[var(--border)] border-t-[var(--text-3)] rounded-full animate-spin" />
    </div>
  )
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement> | undefined}
      type="text"
      inputMode="numeric"
      className="w-full bg-transparent text-right outline-none text-[0.78rem] text-[var(--text)] placeholder:text-[var(--text-3)]"
      value={focused
        ? (value === null ? "" : String(value))
        : (value === null ? "" : value.toLocaleString())}
      placeholder="—"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const raw = e.target.value.replace(/[^\d]/g, "")
        onChange(raw ? parseInt(raw) : null)
      }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeoPage() {
  const [input, setInput]       = useState("")
  const [rows, setRows]         = useState<Row[]>([])
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(0)
  const [copied, setCopied]     = useState(false)
  const [guideIdx, setGuideIdx] = useState<number | null>(null)
  const abortRef                = useRef(false)
  const lookupWindowRef         = useRef<Window | null>(null)
  const kdRef                   = useRef<HTMLInputElement>(null)

  const kwCount = input.split("\n").filter(k => k.trim()).length

  function patchRow(keyword: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.keyword === keyword ? { ...r, ...patch } : r))
  }

  // ── Auto-fetch mode ────────────────────────────────────────────────────────
  async function autoSearch() {
    const keywords = input.split("\n").map(k => k.trim()).filter(Boolean).slice(0, 20)
    if (!keywords.length || running) return
    abortRef.current = false
    setRunning(true); setDone(0); setGuideIdx(null)
    setRows(keywords.map(kw => ({ keyword: kw, google: null, yahoo: null, kd: null, status: "idle" })))

    for (let i = 0; i < keywords.length; i++) {
      if (abortRef.current) break
      const kw = keywords[i]
      patchRow(kw, { status: "loading" })
      const result = await fetchAramaki(kw)
      patchRow(kw, {
        google: result.google,
        yahoo:  result.yahoo,
        status: result.error ? "error" : "done",
      })
      setDone(i + 1)
      if (i < keywords.length - 1 && !abortRef.current)
        await new Promise(r => setTimeout(r, 1000))
    }
    setRunning(false)
  }

  // ── Guided manual mode ─────────────────────────────────────────────────────
  function startGuide() {
    const keywords = input.split("\n").map(k => k.trim()).filter(Boolean).slice(0, 20)
    if (!keywords.length) return
    setRows(keywords.map(kw => ({ keyword: kw, google: null, yahoo: null, kd: null, status: "idle" })))
    setGuideIdx(0)
    openLookup(keywords[0])
  }

  function openLookup(keyword: string) {
    const url = `https://aramakijake.jp/keyword/?keyword=${encodeURIComponent(keyword)}`
    lookupWindowRef.current = window.open(url, "seo-lookup", "noopener")
    setTimeout(() => kdRef.current?.focus(), 80)
  }

  const guideNext = useCallback(() => {
    if (guideIdx === null) return
    const next = guideIdx + 1
    if (next >= rows.length) {
      setGuideIdx(null)
      return
    }
    patchRow(rows[guideIdx].keyword, { status: "done" })
    setGuideIdx(next)
    openLookup(rows[next].keyword)
  }, [guideIdx, rows])

  useEffect(() => {
    if (guideIdx !== null) setTimeout(() => kdRef.current?.focus(), 50)
  }, [guideIdx])

  // ── Copy ──────────────────────────────────────────────────────────────────
  function copyTsv() {
    const header = "キーワード\tKD\tYahoo月間\tGoogle月間"
    const body = rows.map(r =>
      [r.keyword, r.kd ?? "", r.yahoo ?? "", r.google ?? ""].join("\t")
    ).join("\n")
    navigator.clipboard.writeText([header, body].join("\n")).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    })
  }

  const guideRow = guideIdx !== null ? rows[guideIdx] : null

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">

      <div className="mb-6">
        <p className="label-xs mb-1">Tools</p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">SEO Keyword Research</h1>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-3 mb-7">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={"人手不足\n外国人採用\n技能実習生\n…1行1キーワード、最大20件"}
          rows={6}
          className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] resize-none transition-colors"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.73rem] text-[var(--text-3)]">{kwCount} / 20</span>
          <div className="flex-1" />
          {running && (
            <button onClick={() => { abortRef.current = true }}
              className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-3)] hover:text-red-400 hover:border-red-400/50 transition-colors">
              停止
            </button>
          )}
          {/* Guided mode: reliable, opens aramakijake.jp in one named window */}
          <button
            onClick={startGuide}
            disabled={running || !input.trim()}
            title="aramakijake.jpをブラウザで開き、数値を手入力するモード"
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded border text-[0.78rem] font-medium transition-all",
              running || !input.trim()
                ? "border-[var(--border)] text-[var(--text-3)] cursor-not-allowed"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
            )}
          >
            <Icon name="open_in_new" size={14} />
            手入力モード
          </button>
          {/* Auto mode: tries CORS proxy */}
          <button
            onClick={autoSearch}
            disabled={running || !input.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-[0.78rem] font-medium transition-all",
              running || !input.trim()
                ? "bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text-3)] cursor-not-allowed"
                : "bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
            )}
          >
            <Icon name="search" size={14} />
            自動取得
          </button>
        </div>

        {running && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
              <div className="h-full bg-[var(--highlight)] transition-all duration-500"
                style={{ width: rows.length ? `${(done / rows.length) * 100}%` : "0%" }} />
            </div>
            <p className="text-[0.72rem] text-[var(--text-3)]">{done} / {rows.length} 取得中…</p>
          </div>
        )}
      </div>

      {/* Guided mode panel */}
      {guideRow && (
        <div className="mb-5 rounded-xl border border-[var(--highlight)] bg-[color-mix(in_srgb,var(--highlight)_8%,var(--bg))] p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-xs mb-0.5">手入力モード — {guideIdx! + 1} / {rows.length}</p>
              <p className="text-xl font-bold text-[var(--text)]">{guideRow.keyword}</p>
            </div>
            <button
              onClick={() => { patchRow(guideRow.keyword, { status: "done" }); setGuideIdx(null) }}
              className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors mt-0.5"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p className="text-[0.72rem] text-[var(--text-3)]">
            ブラウザで開いたaramakijake.jpの値を入力 → Enterで次へ
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: "KD (Ahrefs)", key: "kd" as const, ref: kdRef },
              { label: "Yahoo 月間", key: "yahoo" as const, ref: undefined },
              { label: "Google 月間", key: "google" as const, ref: undefined },
            ] as Array<{ label: string; key: "kd" | "yahoo" | "google"; ref: React.RefObject<HTMLInputElement> | undefined }>).map(({ label, key, ref }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[0.65rem] text-[var(--text-3)]">{label}</span>
                <input
                  ref={ref}
                  type="text"
                  inputMode="numeric"
                  placeholder="—"
                  value={guideRow[key] === null ? "" : String(guideRow[key])}
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--highlight)] transition-colors w-full text-right"
                  onChange={e => {
                    const raw = e.target.value.replace(/[^\d]/g, "")
                    patchRow(guideRow.keyword, { [key]: raw ? parseInt(raw) : null })
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); guideNext() }
                  }}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => openLookup(guideRow.keyword)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              <Icon name="open_in_new" size={13} />
              再度開く
            </button>
            <button
              onClick={guideNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-medium hover:opacity-80 transition-opacity"
            >
              {guideIdx! + 1 >= rows.length ? "完了" : "次へ →"}
            </button>
          </div>
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="label-xs">{rows.length} キーワード</p>
            <button onClick={copyTsv}
              className={cn(
                "flex items-center gap-1.5 text-[0.75rem] transition-colors",
                copied ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}>
              <Icon name={copied ? "check" : "content_copy"} size={13} />
              {copied ? "コピー済み" : "全部コピー（Excel / Sheets）"}
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="w-full text-[0.78rem] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-2)] text-left">
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] min-w-[140px]">キーワード</th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-24">
                    KD <span className="font-normal normal-case tracking-normal text-[var(--text-3)]">(Ahrefs)</span>
                  </th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-28">Yahoo 月間</th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-28">Google 月間</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => {
                  const isActive = guideIdx === ri
                  const loading  = r.status === "loading"
                  return (
                    <tr key={r.keyword}
                      className={cn(
                        "border-b border-[var(--border)] last:border-0 group",
                        isActive ? "bg-[color-mix(in_srgb,var(--highlight)_8%,var(--bg))]" : "hover:bg-[var(--bg-2)]"
                      )}>
                      <td className="px-3 py-2 text-[var(--text)] font-medium">
                        {r.keyword}
                        {r.status === "error" && <span className="ml-1.5 text-[var(--text-3)] text-[0.65rem]">⚠</span>}
                      </td>
                      <td className="px-3 py-2"><NumCell value={r.kd}    onChange={v => patchRow(r.keyword, { kd:     v })} /></td>
                      <td className="px-3 py-2"><NumCell value={r.yahoo}  onChange={v => patchRow(r.keyword, { yahoo:  v })} loading={loading} /></td>
                      <td className="px-3 py-2"><NumCell value={r.google} onChange={v => patchRow(r.keyword, { google: v })} loading={loading} /></td>
                      <td className="px-3 py-2 text-right">
                        <a href={`https://aramakijake.jp/keyword/?keyword=${encodeURIComponent(r.keyword)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[var(--text-3)] hover:text-[var(--text)] opacity-0 group-hover:opacity-100 transition-all"
                          title="aramakijake.jpで開く">
                          <Icon name="open_in_new" size={12} />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[0.68rem] text-[var(--text-3)] leading-relaxed">
            「自動取得」はCORSプロキシ経由で取得を試みます（ブロックされる場合は⚠）。「手入力モード」は各キーワードをブラウザで順番に開き、数値を手入力します。KDはAhrefs手動入力。コピー後、ExcelまたはGoogle Sheetsに貼り付け。
          </p>
        </div>
      )}
    </div>
  )
}
