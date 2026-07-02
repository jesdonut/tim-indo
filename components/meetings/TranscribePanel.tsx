"use client"

import { useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { cn } from "@/lib/cn"

// ── Minimal WAV encoder ───────────────────────────────────────────────────────

function encodeWAV(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.byteLength
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  const s = (off: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)) }
  s(0, "RIFF"); v.setUint32(4, 36 + dataSize, true)
  s(8, "WAVE"); s(12, "fmt ")
  v.setUint32(16, 16, true); v.setUint16(20, 1, true)   // PCM
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true) // mono
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  s(36, "data"); v.setUint32(40, dataSize, true)
  new Int16Array(buf, 44).set(samples)
  return buf
}

const OUT_RATE = 16000
const MAX_CHUNK_SAMPLES = OUT_RATE * 700 // ~11.6 min per chunk → ~22 MB WAV, safe under Whisper's 25 MB

async function extractAudioChunks(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ blobs: Blob[]; durationSec: number }> {
  onProgress(5)

  // Decode all audio from the file (works for MP4, MOV, MP3, M4A, etc.)
  const arrayBuffer = await file.arrayBuffer()
  onProgress(25)

  const tmpCtx = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer)
  } finally {
    tmpCtx.close()
  }
  onProgress(60)

  // Mix to mono
  const numCh = audioBuffer.numberOfChannels
  const len = audioBuffer.length
  const mono = new Float32Array(len)
  for (let ch = 0; ch < numCh; ch++) {
    const ch_data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < len; i++) mono[i] += ch_data[i] / numCh
  }

  // Resample to 16 kHz (linear interpolation)
  const ratio = audioBuffer.sampleRate / OUT_RATE
  const outLen = Math.round(len / ratio)
  const resampled = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const lo = Math.floor(src)
    const t = src - lo
    const hi = Math.min(lo + 1, len - 1)
    resampled[i] = Math.round(Math.max(-1, Math.min(1, mono[lo] * (1 - t) + mono[hi] * t)) * 0x7FFF)
  }
  onProgress(85)

  // Split into chunks
  const blobs: Blob[] = []
  for (let off = 0; off < resampled.length; off += MAX_CHUNK_SAMPLES) {
    const chunk = resampled.slice(off, off + MAX_CHUNK_SAMPLES)
    blobs.push(new Blob([encodeWAV(chunk, OUT_RATE)], { type: "audio/wav" }))
  }
  onProgress(100)

  return { blobs, durationSec: audioBuffer.duration }
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return `${m}分${s.toString().padStart(2, "0")}秒`
}

// ── Component ─────────────────────────────────────────────────────────────────

type Stage = "idle" | "extracting" | "ready" | "transcribing" | "done" | "error"

export default function TranscribePanel() {
  const [stage, setStage]           = useState<Stage>("idle")
  const [progress, setProgress]     = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([])
  const [durationSec, setDuration]  = useState(0)
  const [chunkDone, setChunkDone]   = useState(0)
  const [transcript, setTranscript] = useState("")
  const [fileName, setFileName]     = useState("")
  const [copied, setCopied]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    setError(null)
    setStage("extracting")
    setProgress(0)
    try {
      const { blobs, durationSec } = await extractAudioChunks(file, setProgress)
      setAudioBlobs(blobs)
      setDuration(durationSec)
      setStage("ready")
    } catch (e) {
      setError(String(e))
      setStage("error")
    }
  }

  async function handleTranscribe() {
    setStage("transcribing")
    setChunkDone(0)
    const parts: string[] = []
    try {
      for (let i = 0; i < audioBlobs.length; i++) {
        const fd = new FormData()
        fd.append("audio", audioBlobs[i], `chunk_${i}.wav`)
        const res = await fetch("/api/transcribe", { method: "POST", body: fd })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        parts.push(json.text)
        setChunkDone(i + 1)
      }
      setTranscript(parts.join("\n"))
      setStage("done")
    } catch (e) {
      setError(String(e))
      setStage("error")
    }
  }

  function reset() {
    setStage("idle"); setAudioBlobs([]); setTranscript(""); setError(null); setCopied(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function copyText() {
    await navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-2)] flex flex-col gap-4">
      <p className="label-xs">文字起こし</p>

      {/* Drop zone */}
      {(stage === "idle" || stage === "error") && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-lg px-6 py-8 text-center cursor-pointer hover:border-[var(--text-2)] transition-colors"
        >
          <Icon name="audio_file" size={30} className="mx-auto text-[var(--text-3)] mb-2" />
          <p className="text-sm text-[var(--text-2)]">動画・音声ファイルをここにドロップ</p>
          <p className="text-[0.72rem] text-[var(--text-3)] mt-1">MP4 · MOV · WebM · MP3 · M4A · WAV</p>
          {error && <p className="mt-3 text-[0.72rem] text-red-400 break-words">{error}</p>}
          <input
            ref={inputRef} type="file" className="hidden"
            accept="video/*,audio/*,.mp4,.mov,.webm,.mp3,.m4a,.wav"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Extracting audio */}
      {stage === "extracting" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--text-2)] truncate">
            <span className="text-[var(--text-3)]">抽出中: </span>{fileName}
          </p>
          <ProgressBar value={progress} />
          <p className="text-[0.72rem] text-[var(--text-3)]">音声トラックをデコードしています…</p>
        </div>
      )}

      {/* Ready to transcribe */}
      {stage === "ready" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={16} className="text-emerald-400 shrink-0" />
            <span className="text-sm text-[var(--text)]">
              音声抽出完了 — {fmtDuration(durationSec)}
              {audioBlobs.length > 1 && <span className="text-[var(--text-3)]"> ({audioBlobs.length}チャンクに分割)</span>}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleTranscribe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.75rem] font-medium hover:opacity-80 transition-opacity"
            >
              <Icon name="record_voice_over" size={14} />
              文字起こし開始
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.75rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
            >
              別のファイル
            </button>
          </div>
          <p className="text-[0.72rem] text-[var(--text-3)]">
            OpenAI Whisper API（日本語）を使用します。<code className="font-mono">OPENAI_API_KEY</code> が必要です。
          </p>
        </div>
      )}

      {/* Transcribing */}
      {stage === "transcribing" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--text-2)]">
            文字起こし中… ({chunkDone}/{audioBlobs.length} チャンク)
          </p>
          <ProgressBar value={Math.round(chunkDone / audioBlobs.length * 100)} />
          <p className="text-[0.72rem] text-[var(--text-3)]">OpenAI Whisper に送信中です。しばらくお待ちください。</p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.72rem] font-medium text-[var(--text-2)]">文字起こし結果</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={copyText}
                className={cn(
                  "flex items-center gap-1 text-[0.72rem] transition-colors",
                  copied ? "text-emerald-400" : "text-[var(--text-3)] hover:text-[var(--text)]"
                )}
              >
                <Icon name={copied ? "check" : "content_copy"} size={13} />
                {copied ? "コピー済み" : "コピー"}
              </button>
              <button
                onClick={reset}
                className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
          <textarea
            className="w-full min-h-48 bg-[var(--bg)] border border-[var(--border)] rounded p-3 text-sm text-[var(--text)] resize-y outline-none focus:border-[var(--text-2)] transition-colors font-mono leading-relaxed"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--highlight)] rounded-full transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
