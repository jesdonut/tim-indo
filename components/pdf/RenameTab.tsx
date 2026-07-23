"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"

// Free-form output naming. You build a pattern out of tokens + literal text,
// e.g.  A_{ID}_{DATE}_{TYPE}  →  A_I2_20260715_住民票.pdf
// Presets live in localStorage (there's no backend).

const PRESET_KEY = "pdf_name_patterns"

type Fields = { id: string; name: string; type: string }

const TOKENS: { token: string; label: string; hint: (f: Fields) => string }[] = [
  { token: "{ID}",    label: "ID",    hint: f => f.id   || "I2" },
  { token: "{NAME}",  label: "名前",  hint: f => f.name || "田中太郎" },
  { token: "{TYPE}",  label: "種類",  hint: f => f.type || "住民票" },
  { token: "{DATE}",  label: "日付",  hint: () => jst("YYYYMMDD") },
  { token: "{YYYY}",  label: "年",    hint: () => jst("YYYY") },
  { token: "{MM}",    label: "月",    hint: () => jst("MM") },
  { token: "{DD}",    label: "日",    hint: () => jst("DD") },
]

// Always Asia/Tokyo — the host runs UTC.
function jst(part: "YYYYMMDD" | "YYYY" | "MM" | "DD"): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const g = (t: string) => p.find(x => x.type === t)!.value
  if (part === "YYYY") return g("year")
  if (part === "MM")   return g("month")
  if (part === "DD")   return g("day")
  return `${g("year")}${g("month")}${g("day")}`
}

// Windows/macOS-illegal filename characters
const ILLEGAL = /[\\/:*?"<>|]/g

export function resolvePattern(pattern: string, f: Fields): string {
  const out = pattern
    .replace(/\{ID\}/g, f.id)
    .replace(/\{NAME\}/g, f.name)
    .replace(/\{TYPE\}/g, f.type)
    .replace(/\{DATE\}/g, jst("YYYYMMDD"))
    .replace(/\{YYYY\}/g, jst("YYYY"))
    .replace(/\{MM\}/g, jst("MM"))
    .replace(/\{DD\}/g, jst("DD"))
  return out
    .replace(ILLEGAL, "")
    .replace(/_{2,}/g, "_")        // collapse gaps left by empty tokens
    .replace(/^[_\-\s]+|[_\-\s]+$/g, "")
    .trim()
}

const inputCls =
  "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]"

export default function RenameTab() {
  const [pattern, setPattern] = useState("{ID}_{NAME}_{TYPE}")
  const [fields, setFields]   = useState<Fields>({ id: "", name: "", type: "" })
  const [files, setFiles]     = useState<File[]>([])
  const [presets, setPresets] = useState<string[]>([])

  useEffect(() => {
    try { setPresets(JSON.parse(localStorage.getItem(PRESET_KEY) ?? "[]")) } catch {}
  }, [])

  function savePreset() {
    const p = pattern.trim()
    if (!p || presets.includes(p)) return
    const next = [p, ...presets].slice(0, 12)
    setPresets(next)
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)) } catch {}
  }
  function removePreset(p: string) {
    const next = presets.filter(x => x !== p)
    setPresets(next)
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)) } catch {}
  }

  const resolved = useMemo(() => resolvePattern(pattern, fields), [pattern, fields])

  function insert(token: string) {
    setPattern(p => (p ? `${p}${p.endsWith("_") ? "" : "_"}${token}` : token))
  }

  // Renaming doesn't touch the bytes — re-download each file under the new name.
  function download(file: File, index: number) {
    const base = resolved || "output"
    const suffix = files.length > 1 ? `_${index + 1}` : ""
    const ext = file.name.match(/\.[^.]+$/)?.[0] ?? ".pdf"
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = `${base}${suffix}${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Pattern */}
      <section className="flex flex-col gap-2">
        <p className="label-xs">出力ファイル名のパターン</p>
        <div className="flex gap-2">
          <input
            className={cn(inputCls, "font-mono")}
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="A_{ID}_{DATE}_{TYPE}"
          />
          <button onClick={savePreset} disabled={!pattern.trim()}
            className="shrink-0 px-3 py-2 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-40">
            保存
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TOKENS.map(t => (
            <button key={t.token} onClick={() => insert(t.token)}
              title={`→ ${t.hint(fields)}`}
              className="px-2 py-1 rounded border border-[var(--border)] text-[0.68rem] font-mono text-[var(--text-2)] hover:text-[var(--highlight-text)] hover:border-[var(--text-2)] transition-colors">
              {t.token}
              <span className="ml-1 text-[var(--text-3)] font-sans">{t.label}</span>
            </button>
          ))}
        </div>

        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {presets.map(p => (
              <span key={p} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded bg-[var(--bg-2)] border border-[var(--border)]">
                <button onClick={() => setPattern(p)}
                  className="text-[0.68rem] font-mono text-[var(--text-2)] hover:text-[var(--text)]">{p}</button>
                <button onClick={() => removePreset(p)} className="text-[var(--text-3)] hover:text-red-400">
                  <Icon name="close" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Values */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="label-xs">ID</span>
          <input className={inputCls} value={fields.id} placeholder="I2"
            onChange={e => setFields(f => ({ ...f, id: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-xs">名前</span>
          <input className={inputCls} value={fields.name} placeholder="田中太郎"
            onChange={e => setFields(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-xs">種類</span>
          <input className={inputCls} value={fields.type} placeholder="住民票"
            onChange={e => setFields(f => ({ ...f, type: e.target.value }))} />
        </label>
      </section>

      {/* Preview */}
      <section className="flex flex-col gap-1">
        <p className="label-xs">プレビュー</p>
        <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2.5">
          <span className="font-mono text-sm text-[var(--highlight-text)] break-all">
            {resolved || <span className="text-[var(--text-3)]">（パターンを入力）</span>}
            {resolved && <span className="text-[var(--text-3)]">.pdf</span>}
          </span>
        </div>
      </section>

      {/* Files */}
      <section className="flex flex-col gap-2">
        <p className="label-xs">ファイル</p>
        <label className="border-2 border-dashed border-[var(--border)] rounded-lg px-6 py-6 text-center cursor-pointer hover:border-[var(--text-2)] transition-colors">
          <Icon name="upload_file" size={24} className="mx-auto text-[var(--text-3)] mb-1" />
          <p className="text-sm text-[var(--text-2)]">クリックしてファイルを選択</p>
          <input type="file" multiple accept="application/pdf,image/*" className="hidden"
            onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </label>

        {files.length > 0 && (
          <div className="flex flex-col divide-y divide-[var(--border-soft)] border border-[var(--border)] rounded">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 min-w-0 text-[0.75rem] text-[var(--text-3)] truncate">{f.name}</span>
                <Icon name="arrow_forward" size={13} className="text-[var(--text-3)] shrink-0" />
                <span className="flex-1 min-w-0 text-[0.75rem] font-mono text-[var(--text)] truncate">
                  {(resolved || "output") + (files.length > 1 ? `_${i + 1}` : "") + (f.name.match(/\.[^.]+$/)?.[0] ?? ".pdf")}
                </span>
                <button onClick={() => download(f, i)} disabled={!resolved}
                  className="shrink-0 px-2.5 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.68rem] font-medium hover:opacity-80 disabled:opacity-40">
                  保存
                </button>
              </div>
            ))}
            {files.length > 1 && (
              <div className="flex justify-end px-3 py-2">
                <button onClick={() => files.forEach((f, i) => download(f, i))} disabled={!resolved}
                  className="px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-semibold hover:opacity-80 disabled:opacity-40">
                  すべて保存 ({files.length})
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
