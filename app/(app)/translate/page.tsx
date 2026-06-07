"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import {
  getPhoneScripts,
  savePhoneScript,
  deletePhoneScript,
  renamePhoneCategory,
  type PhoneScript,
} from "@/app/actions/teams"
import { getWorkers, type Worker } from "@/app/actions/workers"

// ─── Spell panel ──────────────────────────────────────────────────────────────

const KANA_WORDS: Record<string, string> = {
  'ア':'アイス','イ':'イタリア','ウ':'ウイスキー','エ':'エレベーター','オ':'オレンジ',
  'カ':'カメラ','キ':'キーボード','ク':'クリスマス','ケ':'ケーキ','コ':'コーヒー',
  'サ':'サラダ','シ':'シネマ','ス':'スポーツ','セ':'セブン','ソ':'ソファ',
  'タ':'タクシー','チ':'チキン','ツ':'ツアー','テ':'テレビ','ト':'トマト',
  'ナ':'ナイフ','ニ':'ニッポン','ヌ':'ヌードル','ネ':'ネクタイ','ノ':'ノート',
  'ハ':'ハンバーガー','ヒ':'ヒーロー','フ':'フランス','ヘ':'ヘルメット','ホ':'ホテル',
  'マ':'マスク','ミ':'ミルク','ム':'ムービー','メ':'メロン','モ':'モデル',
  'ヤ':'ヤング','ユ':'ユニフォーム','ヨ':'ヨーグルト',
  'ラ':'ラジオ','リ':'リズム','ル':'ルーム','レ':'レストラン','ロ':'ロマンス',
  'ワ':'ワイン','ヲ':'ヲタク','ン':'ワオン','ッ':'ロケット',
  'ガ':'ガム','ギ':'ギター','グ':'グループ','ゲ':'ゲーム','ゴ':'ゴール',
  'ザ':'ザック','ジ':'ジーンズ','ズ':'ズーム','ゼ':'ゼリー','ゾ':'ゾーン',
  'ダ':'ダイヤモンド','デ':'デザイン','ド':'ドラマ',
  'バ':'バナナ','ビ':'ビデオ','ブ':'ブランド','ベ':'ベスト','ボ':'ボール',
  'パ':'パン','ピ':'ピアノ','プ':'プール','ペ':'ペン','ポ':'ポスター',
  'キャ':'キャンプ','キュ':'キューブ','キョ':'キョウト',
  'シャ':'シャワー','シュ':'シュート','ショ':'ショッピング',
  'チャ':'チャンス','チュ':'チューリップ','チョ':'チョコレート',
  'ニャ':'ニャー','ニュ':'ニュース','ニョ':'ニョッキ',
  'ヒャ':'ヒャク','ヒュ':'ヒューマン','ヒョ':'ヒョウ',
  'ミャ':'ミャンマー','ミュ':'ミュージック','ミョ':'ミョウジン',
  'リャ':'リャマ','リュ':'リュック','リョ':'リョカン',
  'ギャ':'ギャラクシー','ギュ':'ギュウニュウ','ギョ':'ギョウザ',
  'ジャ':'ジャズ','ジュ':'ジュース','ジョ':'ジョギング',
  'ビュ':'ビュッフェ','ビョ':'ビョウイン',
  'ピュ':'ピューマ','ピョ':'ピョンヤン',
  'ファ':'ファッション','フィ':'フィルム','フェ':'フェリー','フォ':'フォーク',
  'ウィ':'ウィーン','ウェ':'ウェブ','ウォ':'ウォーター',
  'ティ':'ティッシュ','トゥ':'トゥルー',
  'ディ':'ディズニー','ドゥ':'ドゥカティ',
  'ヴァ':'ヴァイオリン','ヴィ':'ヴィラ','ヴ':'ヴァイオリン','ヴェ':'ヴェール','ヴォ':'ヴォーカル',
  'ツァ':'ツァーリ','チェ':'チェス','ジェ':'ジェット','シェ':'シェフ','イェ':'イェール',
}

const SMALL_KANA = "ァィゥェォャュョヮ"
const KATAKANA_RE = /^[゠-ヿー\s]+$/

function parseKatakana(text: string): string[] {
  const chars: string[] = []
  let i = 0
  while (i < text.length) {
    if (i + 1 < text.length && SMALL_KANA.includes(text[i + 1])) {
      chars.push(text[i] + text[i + 1]); i += 2
    } else {
      chars.push(text[i]); i++
    }
  }
  return chars
}

async function fetchRomaji(text: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en` +
    `&dt=t&dt=rm&dj=1&q=${encodeURIComponent(text)}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  let romaji = ""
  if (data?.sentences) {
    for (const seg of data.sentences) {
      const ro = seg.src_translit || seg.translit || ""
      if (ro) romaji += (romaji ? " " : "") + ro
    }
  }
  return romaji.trim()
}

type SpellResult = { mode: "spell"; chars: string[] } | { mode: "romaji"; text: string }

function SpellPanel() {
  const [input, setInput]       = useState("")
  const [result, setResult]     = useState<SpellResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)
  const [workers, setWorkers]   = useState<Worker[]>([])
  const [wq, setWq]             = useState("")
  const [wOpen, setWOpen]       = useState(false)
  const suppress                = useRef(false)

  useEffect(() => { getWorkers().then(setWorkers) }, [])

  const wResults = wq.trim().length > 0
    ? workers.filter(w => {
        const lq = wq.toLowerCase()
        return (
          (w.worker_id ?? "").toLowerCase().includes(lq) ||
          (w.name_latin ?? "").toLowerCase().includes(lq) ||
          (w.name_kana ?? "").includes(wq)
        )
      }).slice(0, 8)
    : []

  function pickWorker(kana: string) {
    suppress.current = true
    setInput(kana)
    setResult(null)
    setWq("")
    setWOpen(false)
  }

  async function run() {
    const val = input.trim()
    if (!val) return
    if (KATAKANA_RE.test(val)) {
      setResult({ mode: "spell", chars: parseKatakana(val) })
    } else {
      setLoading(true)
      try {
        const r = await fetchRomaji(val)
        setResult({ mode: "romaji", text: r || "(no reading)" })
      } catch {
        setResult({ mode: "romaji", text: "Error fetching romaji" })
      } finally {
        setLoading(false)
      }
    }
  }

  function copyAll() {
    if (!result) return
    const text = result.mode === "spell"
      ? result.chars.map(c => c === "ー" ? "ヨコボウ" : KANA_WORDS[c] ? `${KANA_WORDS[c]} の ${c}` : c).join("\n")
      : result.text
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="label-xs">Spell / Romaji</p>

      {/* Worker name picker — fills spell input with katakana */}
      <div className="relative">
        <input
          value={wq}
          onChange={e => { setWq(e.target.value); setWOpen(true) }}
          onFocus={() => setWOpen(true)}
          onBlur={() => setTimeout(() => {
            if (suppress.current) { suppress.current = false; return }
            setWOpen(false)
          }, 150)}
          placeholder={workers.length > 0 ? `Pick worker name (${workers.length})…` : "Loading workers…"}
          autoComplete="off"
          className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]"
        />
        {wOpen && wq.trim().length > 0 && wResults.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg overflow-hidden">
            {wResults.map(w => {
              const kana  = w.name_kana  ?? ""
              const latin = w.name_latin ?? ""
              return (
                <button key={w.id} onMouseDown={() => pickWorker(kana || latin)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-2)] transition-colors">
                  <span className="flex-1 text-sm text-[var(--text)] truncate">{kana || latin || "—"}</span>
                  {kana && latin && <span className="text-[0.65rem] text-[var(--text-3)] truncate shrink-0">{latin}</span>}
                  {w.worker_id && <span className="text-[0.6rem] text-[var(--highlight-text)] shrink-0">{w.worker_id}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setResult(null) }}
          onKeyDown={e => { if (e.key === "Enter") run() }}
          placeholder="katakana → spell, text → romaji"
          suppressHydrationWarning
          className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] min-w-0"
        />
        <button onClick={run} disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0">
          {loading ? "…" : "Go"}
        </button>
      </div>

      {result && (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
            <span className="label-xs">{result.mode === "spell" ? "Spelling" : "Romaji"}</span>
            <button onClick={copyAll}
              className={cn("text-[0.65rem] px-2 py-0.5 rounded border transition-colors",
                copied ? "border-green-400 text-green-500" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]")}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {result.mode === "spell" ? (
            <div className="divide-y divide-[var(--border-soft)] max-h-80 overflow-y-auto">
              {result.chars.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-2)] transition-colors">
                  <div className="w-9 shrink-0 text-center text-lg font-bold text-[var(--highlight-text)] bg-[var(--bg-2)] rounded px-1 py-0.5 leading-tight">{c}</div>
                  <div className="text-sm text-[var(--text)]">
                    {c === "ー" ? <span className="text-[var(--text-3)] italic">ヨコボウ</span>
                      : KANA_WORDS[c] ? <>
                        <span className="font-semibold">{KANA_WORDS[c]}</span>
                        <span className="text-[var(--text-3)] mx-1">の</span>
                        <span className="font-bold text-[var(--highlight-text)]">{c}</span>
                        {c === "ッ" && <span className="text-[var(--text-3)] text-xs ml-1 italic">（小ツ）</span>}
                      </> : <span className="text-[var(--text-3)] italic">—</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-sm text-[var(--text)] leading-relaxed">{result.text}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Phone panel ──────────────────────────────────────────────────────────────

function fillPlaceholders(text: string, company: string, name: string): string {
  return text
    .replace(/【会社名】/g, company || "【会社名】")
    .replace(/【担当者名】/g, name || "【担当者名】")
}

// Renders script content with 【…】 placeholders either substituted+highlighted
// (if the value is filled) or shown as muted italic (if still empty).
function ScriptText({ content, company, name }: { content: string; company: string; name: string }) {
  const parts = content.split(/(【[^】]+】)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part === "【会社名】") {
          return company
            ? <span key={i} className="font-semibold text-[var(--highlight-text)]">{company}</span>
            : <span key={i} className="italic text-[var(--text-3)]">【会社名】</span>
        }
        if (part === "【担当者名】") {
          return name
            ? <span key={i} className="font-semibold text-[var(--highlight-text)]">{name}</span>
            : <span key={i} className="italic text-[var(--text-3)]">【担当者名】</span>
        }
        // Other placeholders like 【対象者名】【用件】 stay as muted italic
        if (/^【[^】]+】$/.test(part)) {
          return <span key={i} className="italic text-[var(--text-3)]">{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      className={cn("text-[0.65rem] px-2 py-0.5 rounded border transition-colors shrink-0",
        copied ? "border-green-400 text-green-500" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]")}>
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

// ─── Worker name search ───────────────────────────────────────────────────────

function WorkerNameSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [open, setOpen]       = useState(false)
  const suppress              = useRef(false)

  useEffect(() => { getWorkers().then(setWorkers) }, [])

  const q = value
  const results = q.trim().length > 0
    ? workers.filter(w => {
        const lq = q.toLowerCase()
        return (
          (w.worker_id ?? "").toLowerCase().includes(lq) ||
          (w.name_latin ?? "").toLowerCase().includes(lq) ||
          (w.name_kana ?? "").includes(q)
        )
      }).slice(0, 8)
    : []

  const CHIP = "w-16 shrink-0 flex items-center justify-center py-2 text-[0.65rem] font-mono border-l border-[var(--border)] hover:bg-[var(--highlight)]/20 hover:text-[var(--highlight-text)] transition-colors"

  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => {
          if (suppress.current) { suppress.current = false; return }
          setOpen(false)
        }, 150)}
        placeholder="Your name"
        autoComplete="off"
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]"
      />
      {open && q.trim().length > 0 && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full min-w-[280px] bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg overflow-hidden">
          {results.map(w => {
            const latin = w.name_latin ?? ""
            const kana  = w.name_kana  ?? ""
            return (
              <div key={w.id} className="flex items-stretch border-b border-[var(--border)] last:border-0">
                <div className="flex-1 px-2.5 py-2 min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{latin || kana || "—"}</div>
                  {kana && latin && <div className="text-[0.65rem] text-[var(--text-3)] truncate">{kana}</div>}
                  {w.worker_id && <div className="text-[0.6rem] text-[var(--text-3)]">{w.worker_id}</div>}
                </div>
                <button
                  onMouseDown={() => { suppress.current = true; onChange(latin || kana); setOpen(false) }}
                  className={`${CHIP} ${!latin ? "text-[var(--border)] pointer-events-none" : "text-[var(--text-3)]"}`}>
                  Romaji
                </button>
                <button
                  onMouseDown={() => { suppress.current = true; onChange(kana || latin); setOpen(false) }}
                  className={`${CHIP} ${!kana ? "text-[var(--border)] pointer-events-none" : "text-[var(--text-3)]"}`}>
                  カナ
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Phone panel ──────────────────────────────────────────────────────────────

type EditState = { id: string | null; category: string; label: string; content: string; sortOrder: number }

function PhonePanel() {
  const [company, setCompany]     = useState("")
  const [name, setName]           = useState("")
  const [openerCopied, setOpenerCopied] = useState(false)
  const [scripts, setScripts]     = useState<PhoneScript[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<string | null>(null) // id or "new"
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [addingCat, setAddingCat]   = useState(false)
  const [newCat, setNewCat]         = useState("")
  const [renamingCat, setRenamingCat] = useState<string | null>(null)
  const [renameCatVal, setRenameCatVal] = useState("")
  const [showFurigana, setShowFurigana] = useState(false)
  const [readings, setReadings]     = useState<Record<string, string>>({})
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set())

  const openerText = `いつもお世話になっております。${company || "[company name]"}の${name || "[name]"}と申します。`

  useEffect(() => {
    getPhoneScripts().then(data => { setScripts(data); setLoading(false) })
  }, [])

  const grouped = scripts.reduce<Record<string, PhoneScript[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  function startEdit(s: PhoneScript) {
    setEditing(s.id)
    setEditState({ id: s.id, category: s.category, label: s.label, content: s.content, sortOrder: s.sort_order })
    setConfirmDel(null)
  }

  function startAdd(category: string) {
    const sortOrder = (grouped[category]?.length ?? 0)
    setEditing("new")
    setEditState({ id: null, category, label: "", content: "", sortOrder })
    setConfirmDel(null)
  }

  async function save() {
    if (!editState) return
    setSaving(true)
    const res = await savePhoneScript(editState.id, editState.category, editState.label, editState.content, editState.sortOrder)
    if ("error" in res) { setSaving(false); return }
    const updated = await getPhoneScripts()
    setScripts(updated)
    setEditing(null); setEditState(null)
    setSaving(false)
  }

  async function doDelete(id: string) {
    await deletePhoneScript(id)
    setScripts(prev => prev.filter(s => s.id !== id))
    setConfirmDel(null)
  }

  function addCategory() {
    const cat = newCat.trim()
    if (!cat) return
    setAddingCat(false); setNewCat("")
    const sortOrder = 0
    setEditing("new")
    setEditState({ id: null, category: cat, label: "", content: "", sortOrder })
  }

  async function fetchReading(id: string, content: string) {
    if (readings[id] !== undefined || fetchingIds.has(id)) return
    setFetchingIds(prev => new Set(prev).add(id))
    try {
      const reading = await fetchRomaji(content)
      setReadings(prev => ({ ...prev, [id]: reading }))
    } catch {
      setReadings(prev => ({ ...prev, [id]: "" }))
    } finally {
      setFetchingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  function toggleFurigana() {
    const next = !showFurigana
    setShowFurigana(next)
    if (next) {
      scripts.forEach(s => fetchReading(s.id, s.content))
    }
  }

  async function doRenameCategory(oldName: string) {
    const newName = renameCatVal.trim()
    if (!newName || newName === oldName) { setRenamingCat(null); return }
    await renamePhoneCategory(oldName, newName)
    setScripts(prev => prev.map(s => s.category === oldName ? { ...s, category: newName } : s))
    setRenamingCat(null)
  }

  const categories = Object.keys(grouped)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="label-xs">Phone Scripts</p>
        <button onClick={toggleFurigana}
          className={cn("text-[0.65rem] px-2 py-0.5 rounded border transition-colors",
            showFurigana
              ? "border-[var(--highlight-text)] text-[var(--highlight-text)]"
              : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
          )}>
          ふりがな
        </button>
      </div>

      {/* Opener */}
      <div className="border border-[var(--border)] rounded-lg">
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)] rounded-t-lg">
          <span className="text-[0.65rem] font-semibold text-[var(--text-2)] uppercase tracking-wider">Opener</span>
          <button onClick={() => { navigator.clipboard.writeText(openerText); setOpenerCopied(true); setTimeout(() => setOpenerCopied(false), 1200) }}
            className={cn("text-[0.65rem] px-2 py-0.5 rounded border transition-colors", openerCopied ? "border-green-400 text-green-500" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)]")}>
            {openerCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="px-3 pt-2.5 pb-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] text-[var(--text-3)] w-10 shrink-0">会社</span>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
              className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] text-[var(--text-3)] w-10 shrink-0">名前</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]" />
          </div>
        </div>
        <div className="px-3 pb-2.5 pt-1.5 text-sm leading-relaxed text-[var(--text)] rounded-b-lg">
          いつもお世話になっております。
          <span className={cn("font-bold", company ? "text-[var(--highlight-text)]" : "text-[var(--text-3)] italic")}>{company || "[company]"}</span>
          の
          <span className={cn("font-bold", name ? "text-[var(--highlight-text)]" : "text-[var(--text-3)] italic")}>{name || "[name]"}</span>
          と申します。
        </div>
      </div>

      {/* Script categories */}
      {loading ? (
        <p className="text-sm text-[var(--text-3)]">Loading…</p>
      ) : (
        <>
          {categories.map(cat => (
            <div key={cat} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
                {renamingCat === cat ? (
                  <input
                    autoFocus
                    value={renameCatVal}
                    onChange={e => setRenameCatVal(e.target.value)}
                    onBlur={() => doRenameCategory(cat)}
                    onKeyDown={e => { if (e.key === "Enter") doRenameCategory(cat); if (e.key === "Escape") setRenamingCat(null) }}
                    className="label-xs bg-transparent outline-none border-b border-[var(--text-2)] text-[var(--text)] w-48"
                  />
                ) : (
                  <div className="group/cat flex items-center gap-1.5">
                    <span className="label-xs">{cat}</span>
                    <button
                      onClick={() => { setRenamingCat(cat); setRenameCatVal(cat) }}
                      className="opacity-0 group-hover/cat:opacity-100 text-[var(--text-3)] hover:text-[var(--text)] transition-opacity flex items-center">
                      <Icon name="edit" size={12} />
                    </button>
                  </div>
                )}
                <button onClick={() => startAdd(cat)}
                  className="text-[0.65rem] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-colors">
                  + Add
                </button>
              </div>
              <div className="divide-y divide-[var(--border-soft)]">
                {grouped[cat].map(s => (
                  <div key={s.id}>
                    {editing === s.id && editState ? (
                      <div className="px-3 py-3 flex flex-col gap-2 bg-[var(--bg-2)]">
                        <input value={editState.label} onChange={e => setEditState(p => p && ({ ...p, label: e.target.value }))}
                          placeholder="Label"
                          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                        <textarea value={editState.content} onChange={e => setEditState(p => p && ({ ...p, content: e.target.value }))}
                          rows={3} placeholder="Script text"
                          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] resize-none leading-relaxed font-[inherit]" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditing(null); setEditState(null) }}
                            className="px-3 py-1 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
                          <button onClick={save} disabled={saving || !editState.label.trim() || !editState.content.trim()}
                            className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-start gap-2 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.68rem] font-semibold text-[var(--text-2)] mb-0.5">{s.label}</p>
                          <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line">
                            <ScriptText content={s.content} company={company} name={name} />
                          </p>
                          {showFurigana && (
                            <p className="text-[0.65rem] text-[var(--text-3)] mt-0.5 leading-relaxed">
                              {fetchingIds.has(s.id) ? "…" : (readings[s.id] || "")}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyBtn text={fillPlaceholders(s.content, company, name)} />
                          <button onClick={() => startEdit(s)}
                            className="text-[0.65rem] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-colors">
                            Edit
                          </button>
                          {confirmDel === s.id ? (
                            <>
                              <button onClick={() => doDelete(s.id)}
                                className="text-[0.65rem] px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors">Yes</button>
                              <button onClick={() => setConfirmDel(null)}
                                className="text-[0.65rem] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">No</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDel(s.id)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-3)] hover:text-red-400 hover:border-red-400/50 transition-colors">
                              <Icon name="close" size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Inline new script form for this category */}
                {editing === "new" && editState?.category === cat && (
                  <div className="px-3 py-3 flex flex-col gap-2 bg-[var(--bg-2)]">
                    <input value={editState.label} onChange={e => setEditState(p => p && ({ ...p, label: e.target.value }))}
                      placeholder="Label"
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                    <textarea value={editState.content} onChange={e => setEditState(p => p && ({ ...p, content: e.target.value }))}
                      rows={3} placeholder="Script text"
                      className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] resize-none leading-relaxed font-[inherit]" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(null); setEditState(null) }}
                        className="px-3 py-1 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
                      <button onClick={save} disabled={saving || !editState.label.trim() || !editState.content.trim()}
                        className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* New category form for new categories with no existing scripts yet */}
          {editing === "new" && editState && !categories.includes(editState.category) && (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
                <span className="label-xs">{editState.category}</span>
              </div>
              <div className="px-3 py-3 flex flex-col gap-2 bg-[var(--bg-2)]">
                <input value={editState.label} onChange={e => setEditState(p => p && ({ ...p, label: e.target.value }))}
                  placeholder="Label"
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                <textarea value={editState.content} onChange={e => setEditState(p => p && ({ ...p, content: e.target.value }))}
                  rows={3} placeholder="Script text"
                  className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] resize-none leading-relaxed font-[inherit]" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditing(null); setEditState(null) }}
                    className="px-3 py-1 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
                  <button onClick={save} disabled={saving || !editState.label.trim() || !editState.content.trim()}
                    className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add new category */}
          {addingCat ? (
            <div className="flex gap-2">
              <input value={newCat} onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { setAddingCat(false); setNewCat("") } }}
                placeholder="Category name e.g. 定期面談"
                autoFocus
                className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]" />
              <button onClick={addCategory} disabled={!newCat.trim()}
                className="px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
                Add
              </button>
              <button onClick={() => { setAddingCat(false); setNewCat("") }}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.78rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingCat(true)}
              className="text-[0.75rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-left">
              + New category
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TranslatePage() {
  return (
    <div>
      <PageHeader title="Translate" />
      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <SpellPanel />
          <PhonePanel />
        </div>
      </PageContent>
    </div>
  )
}
