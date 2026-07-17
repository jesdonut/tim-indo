"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"

// Read a phone number out loud in Japanese, digit by digit. 0 is ゼロ, and the
// hyphen is read as "の" (standard when giving a number on the phone in Japan).
const DIGIT: Record<string, string> = {
  "0": "ゼロ", "1": "イチ", "2": "ニ", "3": "サン", "4": "ヨン",
  "5": "ゴ", "6": "ロク", "7": "ナナ", "8": "ハチ", "9": "キュウ",
}
const z2h = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

type Token = { raw: string; read: string }

function readPhone(input: string): Token[] {
  const s = z2h(input)
  const out: Token[] = []
  for (const ch of s) {
    if (DIGIT[ch]) out.push({ raw: ch, read: DIGIT[ch] })
    else if (ch === "-" || ch === "ー" || ch === "―" || ch === "－") out.push({ raw: "-", read: "の" })
    // spaces and other characters are ignored
  }
  return out
}

export default function PhoneReadPanel() {
  const [input, setInput] = useState("")
  const [copied, setCopied] = useState(false)

  const tokens = readPhone(input)
  const spoken = tokens.map(t => t.read).join(" ")

  function copy() {
    if (!spoken) return
    navigator.clipboard.writeText(spoken)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="label-xs">電話番号の読み（一桁ずつ）</p>

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="090-1234-5678"
        inputMode="tel"
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]"
      />

      {tokens.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
            <span className="label-xs">読み</span>
            <button onClick={copy}
              className={cn("text-[0.65rem] px-2 py-0.5 rounded border transition-colors",
                copied ? "border-green-400 text-green-500" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]")}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-3 py-3">
            {tokens.map((t, i) => (
              <div key={i} className="flex flex-col items-center min-w-[2.2rem]">
                <span className={cn("text-lg font-bold leading-none",
                  t.raw === "-" ? "text-[var(--text-3)]" : "text-[var(--highlight-text)]")}>
                  {t.raw === "-" ? "‐" : t.raw}
                </span>
                <span className="text-[0.7rem] text-[var(--text-2)] mt-0.5">{t.read}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
