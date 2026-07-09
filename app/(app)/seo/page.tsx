"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { lookupKeyword, type SeoRow } from "@/app/actions/seo"

type Row = SeoRow & { status: "idle" | "loading" | "done" | "error" }

function NumCell({
  value,
  onChange,
  loading,
}: {
  value: number | null
  onChange: (v: number | null) => void
  loading?: boolean
}) {
  const [focused, setFocused] = useState(false)

  if (loading) {
    return (
      <div className="flex justify-end">
        <span className="w-3.5 h-3.5 border border-[var(--border)] border-t-[var(--text-3)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <input
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

export default function SeoPage() {
  const [input, setInput]     = useState("")
  const [rows, setRows]       = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone]       = useState(0)
  const [copied, setCopied]   = useState(false)
  const abortRef              = useRef(false)

  const kwCount = input.split("\n").filter(k => k.trim()).length

  function patchRow(keyword: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.keyword === keyword ? { ...r, ...patch } : r))
  }

  async function search() {
    const keywords = input.split("\n").map(k => k.trim()).filter(Boolean).slice(0, 20)
    if (!keywords.length || running) return

    abortRef.current = false
    setRunning(true)
    setDone(0)
    setRows(keywords.map(kw => ({ keyword: kw, google: null, yahoo: null, kd: null, status: "idle" })))

    for (let i = 0; i < keywords.length; i++) {
      if (abortRef.current) break
      const kw = keywords[i]
      patchRow(kw, { status: "loading" })

      const result = await lookupKeyword(kw)
      patchRow(kw, {
        google: result.google,
        yahoo:  result.yahoo,
        error:  result.error,
        status: result.error ? "error" : "done",
      })
      setDone(i + 1)

      if (i < keywords.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 1300))
      }
    }

    setRunning(false)
  }

  function copyTsv() {
    const header = "キーワード\tKD\tYahoo月間\tGoogle月間"
    const body = rows.map(r =>
      [r.keyword, r.kd ?? "", r.yahoo ?? "", r.google ?? ""].join("\t")
    ).join("\n")

    navigator.clipboard.writeText([header, body].join("\n")).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  function copyRow(r: Row) {
    const text = [r.keyword, r.kd ?? "", r.yahoo ?? "", r.google ?? ""].join("\t")
    navigator.clipboard.writeText(text)
  }

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
        <div className="flex items-center gap-2">
          <span className="text-[0.73rem] text-[var(--text-3)]">
            {kwCount} / 20
          </span>
          <div className="flex-1" />
          {running && (
            <button
              onClick={() => { abortRef.current = true }}
              className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-3)] hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              停止
            </button>
          )}
          <button
            onClick={search}
            disabled={running || !input.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-[0.78rem] font-medium transition-all",
              running || !input.trim()
                ? "bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text-3)] cursor-not-allowed"
                : "bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
            )}
          >
            <Icon name="search" size={14} />
            検索
          </button>
        </div>

        {running && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
              <div
                className="h-full bg-[var(--highlight)] transition-all duration-500"
                style={{ width: rows.length ? `${(done / rows.length) * 100}%` : "0%" }}
              />
            </div>
            <p className="text-[0.72rem] text-[var(--text-3)]">
              {done} / {rows.length} 取得中…（aramakijake.jp）
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="label-xs">{rows.length} キーワード</p>
            <button
              onClick={copyTsv}
              className={cn(
                "flex items-center gap-1.5 text-[0.75rem] transition-colors",
                copied ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              <Icon name={copied ? "check" : "content_copy"} size={13} />
              {copied ? "コピー済み" : "全部コピー（Excel / Sheets用）"}
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="w-full text-[0.78rem] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-2)] text-left">
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] min-w-[140px]">
                    キーワード
                  </th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-20">
                    KD
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-3)]">(Ahrefs)</span>
                  </th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-28">
                    Yahoo 月間
                  </th>
                  <th className="px-3 py-2 font-semibold text-[0.68rem] uppercase tracking-wide text-[var(--text-2)] text-right w-28">
                    Google 月間
                  </th>
                  <th className="px-3 py-2 w-14 text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const loading = r.status === "loading"
                  const errored = r.status === "error"
                  return (
                    <tr key={r.keyword} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)] group">
                      <td className="px-3 py-2 text-[var(--text)] font-medium">
                        {r.keyword}
                        {errored && (
                          <span
                            className="ml-1.5 text-[var(--text-3)] text-[0.65rem]"
                            title={r.error}
                          >⚠</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <NumCell
                          value={r.kd}
                          onChange={v => patchRow(r.keyword, { kd: v })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumCell
                          value={r.yahoo}
                          loading={loading}
                          onChange={v => patchRow(r.keyword, { yahoo: v })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumCell
                          value={r.google}
                          loading={loading}
                          onChange={v => patchRow(r.keyword, { google: v })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyRow(r)}
                            title="この行をコピー"
                            className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                          >
                            <Icon name="content_copy" size={12} />
                          </button>
                          <a
                            href={`https://aramakijake.jp/term/search/?keyword=${encodeURIComponent(r.keyword)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="aramakijake.jpで開く"
                            className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                          >
                            <Icon name="open_in_new" size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[0.68rem] text-[var(--text-3)] leading-relaxed">
            Yahoo・Google数値はaramakijake.jpから自動取得（⚠が出たら手動入力）。KDはAhrefsの値を手動入力。全部コピー後、ExcelまたはGoogle Sheetsに貼り付け（Ctrl+V）。
          </p>
        </div>
      )}

    </div>
  )
}
