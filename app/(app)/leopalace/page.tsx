"use client"

import { useState } from "react"
import { extractGuidebook, lookupPostal, lookupPostalByAddress, type GuidebookData, type PostalResult } from "@/app/actions/extract"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import SpellPanel from "@/components/extract/SpellPanel"

type CopiedKey = keyof GuidebookData | "all" | null

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
]

// ─── Address verification links ───────────────────────────────────────────────
// The guidebook's 〒 and romaji reading are frequently wrong, so rather than
// trust them, link straight out to sources that show the correct value.

function AddressLinks({ address }: { address: string }) {
  const q = encodeURIComponent(address)
  const links = [
    // Maps displays the authoritative postal code for the address
    { href: `https://www.google.com/maps/search/?api=1&query=${q}`, label: "Maps", icon: "map" },
    // Google Translate gives a romaji reading of the whole address
    { href: `https://translate.google.com/?sl=ja&tl=en&op=translate&text=${q}`, label: "読み", icon: "translate" },
    // Jisho is better for looking up an individual place-name kanji
    { href: `https://jisho.org/search/${q}`, label: "Jisho", icon: "menu_book" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {links.map(l => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border)] text-[0.65rem] text-[var(--text-3)] hover:text-[var(--highlight-text)] hover:border-[var(--text-2)] transition-colors">
          <Icon name={l.icon} size={11} />
          {l.label}
        </a>
      ))}
    </div>
  )
}

// ─── Single extraction panel (URL + postal) ───────────────────────────────────

function UrlPanel({ label }: { label?: string }) {
  const [url, setUrl]           = useState("")
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState<GuidebookData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState<CopiedKey>(null)

  const [postal, setPostal]               = useState("")
  const [postalLoading, setPostalLoading] = useState(false)
  const [postalResults, setPostalResults] = useState<PostalResult[] | null>(null)
  const [postalError, setPostalError]     = useState<string | null>(null)
  const [copiedPostal, setCopiedPostal]   = useState<string | null>(null)
  const [postalMode, setPostalMode]       = useState<"code" | "address">("code")
  const [addrPref, setAddrPref]           = useState("")
  const [addrCity, setAddrCity]           = useState("")

  async function run() {
    if (!url.trim()) return
    setLoading(true); setData(null); setError(null)
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
      `${data.apartmentName} ${data.roomNumber}${data.apNumber ? ` (AP ${data.apNumber})` : ""}`,
      data.postalCode ? `〒 ${data.postalCode}` : null,
      `住所: ${data.address}`,
      data.addressRomaji ? `読み: ${data.addressRomaji}` : null,
      `電気: ${data.electricity}`,
      `ガス (${data.gasCompany}): ${data.gasPhone}`,
      `水道: ${data.water}`,
    ].filter(Boolean).join("\n")
    copy("all", text)
  }

  async function runPostal(code = postal) {
    if (!code.trim()) return
    setPostalLoading(true); setPostalResults(null); setPostalError(null)
    const res = await lookupPostal(code.trim())
    setPostalLoading(false)
    if (res.error) setPostalError(res.error)
    else if (res.results) setPostalResults(res.results)
  }

  function onPostalChange(val: string) {
    setPostal(val)
    if (val.replace(/[^0-9]/g, "").length === 7) runPostal(val)
  }

  async function runPostalByAddress() {
    if (!addrPref) return
    setPostalLoading(true); setPostalResults(null); setPostalError(null)
    const res = await lookupPostalByAddress(addrPref, addrCity || undefined)
    setPostalLoading(false)
    if (res.error) setPostalError(res.error)
    else if (res.results) setPostalResults(res.results)
  }

  async function copyPostal(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedPostal(key)
    setTimeout(() => setCopiedPostal(null), 1200)
  }

  const rows: { key: keyof GuidebookData; label: string; value: string; sub?: string; reading?: string }[] = data ? [
    { key: "apNumber",    label: "AP番号", value: data.apNumber },
    { key: "address",     label: "住所",   value: data.address, reading: data.addressRomaji, sub: data.postalCode ? `〒 ${data.postalCode}` : undefined },
    { key: "electricity", label: "電気",   value: data.electricity },
    { key: "gasPhone",    label: "ガス",   value: data.gasPhone, sub: data.gasCompany },
    { key: "water",       label: "水道",   value: data.water },
  ] : []

  return (
    <div className="flex flex-col gap-4 flex-1 min-w-0">
      {label && <p className="label-xs">{label}</p>}


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
          onClick={run} disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Extract"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
      )}

      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{data.apartmentName}</p>
              <p className="text-sm text-[var(--text-2)] mt-0.5">{data.roomNumber}</p>
            </div>
            <button onClick={copyAll}
              className={cn("shrink-0 text-[0.72rem] font-medium transition-all mt-1",
                copied === "all" ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
              {copied === "all" ? "Copied!" : "Copy all"}
            </button>
          </div>

          {rows.map(({ key, label: rowLabel, value, sub, reading }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border-soft)]">
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="label-xs shrink-0">{rowLabel}</span>
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm text-[var(--text)] font-mono">{value || "—"}</span>
                  {sub && <span className="text-[0.72rem] text-[var(--text-3)]">{sub}</span>}
                  {reading && <span className="text-[0.75rem] text-[var(--text-2)]">{reading}</span>}
                  {/* The scraped 〒 and romaji are often wrong — link out to verify.
                      Maps shows the real postal code for the address. */}
                  {key === "address" && value && <AddressLinks address={value} />}
                </div>
              </div>
              {value && (
                <button onClick={() => copy(key, value)}
                  className={cn("shrink-0 text-[0.65rem] transition-all",
                    copied === key ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
                  {copied === key ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Postal lookup */}
      <div className="border-t border-[var(--border)] pt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="label-xs">Postal code</p>
          <div className="flex gap-1 p-0.5 rounded bg-[var(--bg-2)] border border-[var(--border)]">
            {(["code", "address"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setPostalMode(m); setPostalResults(null); setPostalError(null) }}
                className={cn("px-2 py-0.5 rounded text-[0.65rem] font-medium transition-colors",
                  postalMode === m ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}
              >
                {m === "code" ? "〒 Code" : "住所から"}
              </button>
            ))}
          </div>
        </div>

        {postalMode === "code" ? (
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
              onClick={() => runPostal()} disabled={postalLoading || !postal.trim()}
              className="px-4 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {postalLoading ? "..." : "Look up"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select
                className={cn(
                  "flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
                  "text-[var(--text)] text-sm outline-none focus:border-[var(--text)] transition-colors"
                )}
                value={addrPref}
                onChange={e => { setAddrPref(e.target.value); setPostalResults(null) }}
              >
                <option value="">都道府県を選択…</option>
                {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                className={cn(
                  "flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
                  "text-[var(--text)] text-sm placeholder:text-[var(--text-3)]",
                  "outline-none focus:border-[var(--text)] transition-colors"
                )}
                placeholder="市区町村名（任意）"
                value={addrCity}
                onChange={e => setAddrCity(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runPostalByAddress()}
              />
              <button
                onClick={runPostalByAddress} disabled={postalLoading || !addrPref}
                className="px-4 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {postalLoading ? "..." : "Search"}
              </button>
            </div>
          </div>
        )}

        {postalError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{postalError}</p>
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
                <button onClick={() => copyPostal(r.address, `${i}-addr`)}
                  className={cn("shrink-0 text-[0.65rem] transition-all mt-0.5",
                    copiedPostal === `${i}-addr` ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
                  {copiedPostal === `${i}-addr` ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeopalacePage() {
  return (
    <div>
      <PageHeader title="Leopalace" />
      <PageContent>
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* LEFT: name spelling */}
          <aside className="w-full lg:w-[340px] shrink-0">
            <SpellPanel />
          </aside>

          <div className="hidden lg:block w-px self-stretch bg-[var(--border)] shrink-0" />

          {/* RIGHT: guidebook extraction — 引越し元 / 引越し先 */}
          <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-6">
            <UrlPanel label="引越し元（現住所）" />
            <div className="hidden md:block w-px bg-[var(--border)] shrink-0" />
            <UrlPanel label="引越し先（新住所）" />
          </div>
        </div>
      </PageContent>
    </div>
  )
}
