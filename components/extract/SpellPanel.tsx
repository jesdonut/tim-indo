"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { getWorkers, type Worker } from "@/app/actions/workers"

// Katakana → example-word spelling, for reading a name out loud on the phone.
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

export default function SpellPanel() {
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
      <p className="label-xs">Spell / Romaji（名前の読み）</p>

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
