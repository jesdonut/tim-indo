"use client"

import { useState } from "react"
import { extractGuidebook, lookupPostal, type GuidebookData, type PostalResult } from "@/app/actions/extract"
import { parsePhones, type PhoneEntry } from "@/components/extract/parsePhones"
import { cn } from "@/lib/cn"

type CopiedKey = keyof GuidebookData | "all" | null
type Tab = "url" | "text"

const TYPE_COLORS: Record<string, string> = {
  "電気": "bg-blue-400/15 text-blue-600 dark:text-blue-300",
  "ガス": "bg-orange-400/15 text-orange-600 dark:text-orange-300",
  "水道": "bg-cyan-400/15 text-cyan-600 dark:text-cyan-300",
  "FAX":  "bg-[var(--bg-2)] text-[var(--text-3)]",
  "TEL":  "bg-[var(--bg-2)] text-[var(--text-2)]",
  "鍵":   "bg-yellow-400/15 text-yellow-600 dark:text-yellow-300",
  "光回線":"bg-purple-400/15 text-purple-600 dark:text-purple-300",
}

export default function ExtractPage() {
  const [tab, setTab] = useState<Tab>("url")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData]     = useState<GuidebookData | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [copied, setCopied] = useState<CopiedKey>(null)

  // Postal
  const [postal, setPostal]             = useState("")
  const [postalLoading, setPostalLoading] = useState(false)
  const [postalResults, setPostalResults] = useState<PostalResult[] | null>(null)
  const [postalError, setPostalError]   = useState<string | null>(null)
  const [copiedPostal, setCopiedPostal] = useState<string | null>(null)

  async function runPostal(code = postal) {
    if (!code.trim()) return
    setPostalLoading(true)
    setPostalResults(null)
    setPostalError(null)
    const res = await lookupPostal(code.trim())
    setPostalLoading(false)
    if (res.error) setPostalError(res.error)
    else if (res.results) setPostalResults(res.results)
  }

  // Auto-lookup when 7 digits entered
  function onPostalChange(val: string) {
    setPostal(val)
    if (val.replace(/[^0-9]/g, "").length === 7) runPostal(val)
  }

  async function copyPostal(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedPostal(key)
    setTimeout(() => setCopiedPostal(null), 1200)
  }

  // Text dump
  const [dumpText, setDumpText]         = useState("")
  const [dumpEntries, setDumpEntries]   = useState<PhoneEntry[] | null>(null)
  const [copiedDump, setCopiedDump]     = useState<string | null>(null)

  function runDump(text = dumpText) {
    const entries = parsePhones(text)
    setDumpEntries(entries)
  }

  async function copyDump(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedDump(key)
    setTimeout(() => setCopiedDump(null), 1200)
  }

  async function run() {
    if (!url.trim()) return
    setLoading(true)
    setData(null)
    setError(null)
    const result = await extractGuidebook(url.trim())
    setLoading(false)
    if (result.error) setError(result.error)
    else if (result.data) setData(result.data)
  }

  async function copy(key: CopiedKey, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1200)
  }

  async function copyAll() {
    if (!data) return
    const text = [
      `${data.apartmentName} ${data.roomNumber}`,
      data.postalCode ? `〒 ${data.postalCode}` : null,
      `住所: ${data.address}`,
      data.addressRomaji ? `読み: ${data.addressRomaji}` : null,
      `電気: ${data.electricity}`,
      `ガス (${data.gasCompany}): ${data.gasPhone}`,
      `水道: ${data.water}`,
    ].filter(Boolean).join("\n")
    copy("all", text)
  }

  const rows: { key: keyof GuidebookData; label: string; value: string; sub?: string; reading?: string }[] = data ? [
    { key: "address",     label: "住所",  value: data.address, reading: data.addressRomaji, sub: data.postalCode ? `〒 ${data.postalCode}` : undefined },
    { key: "electricity", label: "電気",  value: data.electricity },
    { key: "gasPhone",    label: "ガス",  value: data.gasPhone, sub: data.gasCompany },
    { key: "water",       label: "水道",  value: data.water },
  ] : []

  return (
    <div className="max-w-xl mx-auto px-5 py-10 flex flex-col gap-8">

      <div className="border-b border-[var(--border)] pb-4 flex items-end justify-between">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Extract</h1>
        <div className="flex items-center gap-0.5 bg-[var(--bg-2)] rounded p-0.5">
          {(["url", "text"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1 rounded text-[0.72rem] font-medium transition-all",
                tab === t ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-2)] hover:text-[var(--text)]"
              )}
            >
              {t === "url" ? "URL" : "Text dump"}
            </button>
          ))}
        </div>
      </div>

      {/* ── TEXT DUMP TAB ── */}
      {tab === "text" && (
        <div className="flex flex-col gap-4">
          <textarea
            className={cn(
              "w-full min-h-[180px] bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5 resize-y",
              "text-[var(--text)] text-sm placeholder:text-[var(--text-3)]",
              "outline-none focus:border-[var(--text)] transition-colors font-mono"
            )}
            placeholder={"（電気）東京電力　0120-278-033\n（ガス）曽我部瓦斯　04-7092-1011\nTEL：04-7093-0900"}
            value={dumpText}
            onChange={e => { setDumpText(e.target.value); runDump(e.target.value) }}
          />

          {dumpEntries && dumpEntries.length === 0 && dumpText.trim() && (
            <p className="text-sm text-[var(--text-3)]">No phone numbers found.</p>
          )}

          {dumpEntries && dumpEntries.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--border-soft)]">
              {dumpEntries.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {e.type && (
                        <span className={cn("text-[0.6rem] font-bold px-1.5 py-0.5 rounded", TYPE_COLORS[e.type] ?? "bg-[var(--bg-2)] text-[var(--text-3)]")}>
                          {e.type}
                        </span>
                      )}
                      <span className="text-sm font-mono text-[var(--text)]">{e.phone}</span>
                    </div>
                    {e.company && (
                      <span className="text-[0.75rem] text-[var(--text-2)] truncate">{e.company}</span>
                    )}
                  </div>
                  <button
                    onClick={() => copyDump(e.phone, `${i}`)}
                    className={cn("shrink-0 text-[0.65rem] transition-all mt-0.5",
                      copiedDump === `${i}` ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
                    )}
                  >
                    {copiedDump === `${i}` ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── URL TAB ── */}
      {tab === "url" && <>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          className={cn(
            "flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
            "text-[var(--text)] text-sm placeholder:text-[var(--text-3)]",
            "outline-none focus:border-[var(--text)] transition-colors"
          )}
          placeholder="https://eco.leopalace21.com/client/common/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
        />
        <button
          onClick={run}
          disabled={loading || !url.trim()}
          className={cn(
            "px-4 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold shrink-0",
            "hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {loading ? "..." : "Extract"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Results */}
      {data && (
        <div className="flex flex-col gap-3">

          {/* Apartment header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{data.apartmentName}</p>
              <p className="text-sm text-[var(--text-2)]">{data.roomNumber}</p>
            </div>
            <button
              onClick={copyAll}
              className={cn(
                "shrink-0 text-[0.72rem] font-medium transition-all mt-1",
                copied === "all" ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
              )}
            >
              {copied === "all" ? "Copied!" : "Copy all"}
            </button>
          </div>

          {/* Field rows */}
          {rows.map(({ key, label, value, sub, reading }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-soft)]"
            >
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="label-xs shrink-0">{label}</span>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm text-[var(--text)] font-mono">{value || "—"}</span>
                  {sub && <span className="text-[0.72rem] text-[var(--text-3)]">{sub}</span>}
                  {reading && <span className="text-[0.75rem] text-[var(--text-2)]">{reading}</span>}
                </div>
              </div>
              {value && (
                <button
                  onClick={() => copy(key, value)}
                  className={cn(
                    "shrink-0 text-[0.65rem] transition-all",
                    copied === key ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  {copied === key ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Postal code lookup ── */}
      <div className="border-t border-[var(--border)] pt-8 flex flex-col gap-4">
        <div className="border-b border-[var(--border)] pb-4">
          <p className="label-xs mb-1">Postal code</p>
          <p className="text-xs text-[var(--text-3)]">Enter a 7-digit Japan postal code</p>
        </div>

        <div className="flex gap-2">
          <input
            className={cn(
              "flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
              "text-[var(--text)] text-sm placeholder:text-[var(--text-3)] font-mono tracking-wider",
              "outline-none focus:border-[var(--text)] transition-colors"
            )}
            placeholder="123-4567"
            value={postal}
            onChange={e => onPostalChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runPostal()}
            maxLength={8}
          />
          <button
            onClick={() => runPostal()}
            disabled={postalLoading || !postal.trim()}
            className={cn(
              "px-4 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold shrink-0",
              "hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {postalLoading ? "..." : "Look up"}
          </button>
        </div>

        {postalError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
            {postalError}
          </p>
        )}

        {postalResults && (
          <div className="flex flex-col gap-2">
            {postalResults.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-soft)]">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm text-[var(--text)]">{r.address}</span>
                  <span className="text-[0.75rem] text-[var(--text-2)]">{r.reading}</span>
                  <span className="text-[0.65rem] text-[var(--text-3)] font-mono">{r.zipcode.slice(0,3)}-{r.zipcode.slice(3)}</span>
                </div>
                <button
                  onClick={() => copyPostal(r.address, `${i}-addr`)}
                  className={cn(
                    "shrink-0 text-[0.65rem] transition-all mt-0.5",
                    copiedPostal === `${i}-addr` ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  {copiedPostal === `${i}-addr` ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      </> /* end URL tab */}

    </div>
  )
}
