"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"
import { cn } from "@/lib/cn"
import { PageHeader, PillTabs, ToolContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import { getWorkers, type Worker } from "@/app/actions/workers"

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return b + " B"
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB"
  return (b / 1048576).toFixed(1) + " MB"
}

function rotClass(deg: number) {
  return deg === 90 ? "rotate-90" : deg === 180 ? "rotate-180" : deg === 270 ? "-rotate-90" : ""
}

async function rotateImageToJpeg(src: File | Blob, rotation: number): Promise<ArrayBuffer> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(src)
    const img = new Image()
    img.onload = () => {
      const swap = rotation === 90 || rotation === 270
      const canvas = document.createElement("canvas")
      canvas.width  = swap ? img.naturalHeight : img.naturalWidth
      canvas.height = swap ? img.naturalWidth  : img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => blob!.arrayBuffer().then(resolve), "image/jpeg", 0.9)
    }
    img.src = url
  })
}

function triggerDownload(bytes: Uint8Array | ArrayBuffer, name: string) {
  const blob = new Blob([bytes instanceof Uint8Array ? bytes.buffer as ArrayBuffer : bytes], { type: "application/pdf" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ─── Crop modal (shared) ─────────────────────────────────────────────────────

type CropDone = (blob: Blob) => void

function CropModal({ imgSrc, onApply, onCancel, cropperReady }: {
  imgSrc: string | null
  onApply: CropDone
  onCancel: () => void
  cropperReady: boolean
}) {
  const imgRef    = useRef<HTMLImageElement>(null)
  const cropperRef = useRef<unknown>(null)
  const [angle, setAngle] = useState(0)
  const baseAngle = useRef(0)

  useEffect(() => {
    if (!imgSrc || !cropperReady || !imgRef.current) return
    const img = imgRef.current
    if ((cropperRef.current as any)?.destroy) (cropperRef.current as any).destroy()
    img.onload = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cropperRef.current = new (window as any).Cropper(img, {
          viewMode: 1, autoCropArea: 0.95, movable: true, zoomable: true, rotatable: true,
        })
      }))
    }
    img.src = imgSrc
    setAngle(0); baseAngle.current = 0
  }, [imgSrc, cropperReady])

  function rotateCrop(deg: number) {
    baseAngle.current += deg
    if ((cropperRef.current as any)?.rotateTo)
      (cropperRef.current as any).rotateTo(baseAngle.current + angle)
  }

  function apply() {
    if (!(cropperRef.current as any)?.getCroppedCanvas) return
    const canvas = (cropperRef.current as any).getCroppedCanvas({ fillColor: "#ffffff", imageSmoothingQuality: "high" })
    canvas.toBlob((blob: Blob) => {
      if ((cropperRef.current as any)?.destroy) (cropperRef.current as any).destroy()
      cropperRef.current = null
      onApply(blob)
    }, "image/jpeg", 0.92)
  }

  function cancel() {
    if ((cropperRef.current as any)?.destroy) (cropperRef.current as any).destroy()
    cropperRef.current = null
    onCancel()
  }

  if (!imgSrc) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]"><Icon name="content_cut" size={16} /> Crop &amp; Straighten</div>
        <button onClick={cancel} className="w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]"><Icon name="close" size={18} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-[#111]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src="" alt="" className="block max-w-full" />
      </div>
      <div className="shrink-0 px-4 py-3 bg-[var(--bg)] border-t border-[var(--border)] flex flex-col gap-3">
        <div className="flex gap-2">
          <button onClick={() => rotateCrop(-90)} className="flex-1 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↺ Left</button>
          <button onClick={() => rotateCrop(90)}  className="flex-1 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↻ Right</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-3)] shrink-0">Straighten</span>
          <input type="range" min="-45" max="45" step="0.5" value={angle}
            onChange={e => {
              const v = parseFloat(e.target.value); setAngle(v)
              if ((cropperRef.current as any)?.rotateTo)
                (cropperRef.current as any).rotateTo(baseAngle.current + v)
            }}
            className="flex-1 accent-[var(--highlight)]" />
          <span className="text-xs font-mono text-[var(--text)] w-10 text-right shrink-0">{angle > 0 ? "+" : ""}{angle.toFixed(1)}°</span>
        </div>
        <div className="flex gap-2">
          <button onClick={cancel} className="flex-1 py-2.5 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={apply}  className="flex-[2] py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold hover:opacity-80 transition-opacity">Apply</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Merge ───────────────────────────────────────────────────────────────

type MergeEntry = { file: File; rotation: number; editedBlob: Blob | null }
const MERGE_SAVED_KEY = "pdf_saved_names"

function MergeTab({ cropperReady }: { cropperReady: boolean }) {
  const [entries, setEntries]   = useState<MergeEntry[]>([])
  const [filename, setFilename] = useState("output")
  const [saved, setSaved]       = useState<string[]>([])
  const [status, setStatus]     = useState<{ msg: string; type: "" | "error" | "success" }>({ msg: "", type: "" })
  const [progress, setProgress] = useState(-1)
  const [building, setBuilding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragSrc, setDragSrc]   = useState<number | null>(null)
  const [editIdx, setEditIdx]   = useState<number | null>(null)
  const [cropSrc, setCropSrc]   = useState<string | null>(null)
  const [preview, setPreview]   = useState<{ src: string; rot: number; x: number; y: number } | null>(null)

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(MERGE_SAVED_KEY) ?? "[]")) } catch {}
  }, [])

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter(i => i.kind === "file").map(i => i.getAsFile()).filter(Boolean) as File[]
      if (files.length) addFiles(files)
    }
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  }, [])

  function addFiles(newFiles: File[]) {
    const valid = newFiles.filter(f => ["application/pdf","image/jpeg","image/png"].includes(f.type))
    if (!valid.length && newFiles.length) { setStatus({ msg: "Only PDF, JPG, PNG supported.", type: "error" }); return }
    setStatus({ msg: "", type: "" })
    setEntries(prev => [...prev, ...valid.map(f => ({ file: f, rotation: 0, editedBlob: null }))])
  }

  function rotate(i: number, dir: 1 | -1) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, rotation: (e.rotation + dir * 90 + 360) % 360 } : e))
  }

  function openCrop(i: number) {
    const e = entries[i]
    setEditIdx(i)
    const src = e.editedBlob ?? e.file
    if (e.rotation !== 0) {
      rotateImageToJpeg(src, e.rotation).then(bytes => {
        setCropSrc(URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" })))
      })
    } else {
      setCropSrc(URL.createObjectURL(src))
    }
  }

  function saveName() {
    const name = filename.trim()
    if (!name || name === "output") return
    const names: string[] = JSON.parse(localStorage.getItem(MERGE_SAVED_KEY) ?? "[]")
    if (!names.includes(name)) {
      const next = [name, ...names].slice(0, 20)
      localStorage.setItem(MERGE_SAVED_KEY, JSON.stringify(next)); setSaved(next)
    }
  }

  function deleteSaved(name: string) {
    const next: string[] = JSON.parse(localStorage.getItem(MERGE_SAVED_KEY) ?? "[]").filter((n: string) => n !== name)
    localStorage.setItem(MERGE_SAVED_KEY, JSON.stringify(next)); setSaved(next)
  }

  async function handleDownload() {
    if (!entries.length) { setStatus({ msg: "Add at least one file first.", type: "error" }); return }
    setBuilding(true); setStatus({ msg: "Processing...", type: "" }); setProgress(5)
    try {
      const { PDFDocument, degrees } = await import("pdf-lib")
      const pdfDoc = await PDFDocument.create()
      for (let i = 0; i < entries.length; i++) {
        setProgress(10 + Math.round((i / entries.length) * 80))
        const { file, rotation, editedBlob } = entries[i]
        const src = editedBlob ?? file
        if (file.type === "application/pdf") {
          const bytes = await file.arrayBuffer()
          const srcDoc = await PDFDocument.load(bytes)
          const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices())
          for (const p of pages) {
            if (rotation) p.setRotation(degrees((p.getRotation().angle + rotation) % 360))
            pdfDoc.addPage(p)
          }
        } else {
          const bytes = await rotateImageToJpeg(src, rotation)
          const img = await pdfDoc.embedJpg(bytes)
          const scale = Math.min(1, 595 / img.width, 842 / img.height)
          const page = pdfDoc.addPage([Math.round(img.width * scale), Math.round(img.height * scale)])
          page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
        }
      }
      setProgress(95)
      const bytes = await pdfDoc.save({ useObjectStreams: true })
      const name  = (filename.trim() || "output").replace(/\.pdf$/i, "") + ".pdf"
      triggerDownload(bytes, name)
      setProgress(100)
      setStatus({ msg: `Downloaded "${name}" (${(bytes.byteLength / 1048576).toFixed(1)} MB)`, type: "success" })
      setTimeout(() => setProgress(-1), 1800)
    } catch (err: unknown) {
      setStatus({ msg: "Error: " + (err instanceof Error ? err.message : String(err)), type: "error" })
      setProgress(-1)
    } finally { setBuilding(false) }
  }

  const onDropZone = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
          onDrop={onDropZone}
          onClick={() => document.getElementById("mergeFileInput")?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-all select-none",
            dragOver ? "border-[var(--highlight)] bg-[var(--highlight)]/5" : "border-[var(--border)] hover:border-[var(--text-3)] hover:bg-[var(--bg-2)]"
          )}
        >
          <div className="text-[var(--text-3)] mb-2"><Icon name="description" size={36} /></div>
          <p className="text-sm font-medium text-[var(--text)]">Drop files here</p>
          <p className="text-xs text-[var(--text-3)] mt-1">PDF · JPG · PNG &nbsp;·&nbsp; or paste (Ctrl+V)</p>
          <span className="mt-3 inline-block px-4 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--text-2)]">Browse</span>
          <input id="mergeFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="label-xs">Files ({entries.length})</p>
              <button onClick={() => setEntries([])} className="text-[0.68rem] text-[var(--text-3)] hover:text-red-400 border border-[var(--border)] rounded px-2 py-0.5">Clear all</button>
            </div>
            {entries.map((entry, i) => {
              const isPdf = entry.file.type === "application/pdf"
              const thumbSrc = !isPdf ? URL.createObjectURL(entry.editedBlob ?? entry.file) : null
              return (
                <div key={i} draggable
                  onDragStart={() => setDragSrc(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragSrc === null || dragSrc === i) return
                    setEntries(prev => { const n = [...prev]; const [m] = n.splice(dragSrc, 1); n.splice(i, 0, m); return n })
                    setDragSrc(null)
                  }}
                  className={cn("flex items-center gap-3 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing", dragSrc === i && "opacity-30")}
                >
                  <span className="text-[var(--border)] select-none shrink-0 flex items-center"><Icon name="drag_indicator" size={18} /></span>
                  <div className="w-10 h-10 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0"
                    onMouseEnter={e => thumbSrc && setPreview({ src: thumbSrc, rot: entry.rotation, x: e.clientX, y: e.clientY })}
                    onMouseMove={e => thumbSrc && setPreview(p => p ? { ...p, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setPreview(null)}>
                    {isPdf ? <Icon name="description" size={22} className="text-[var(--text-3)]" /> : <img src={thumbSrc!} className={cn("w-full h-full object-cover", rotClass(entry.rotation))} alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{entry.file.name}</p>
                    <p className="text-[0.65rem] text-[var(--text-3)]">
                      {isPdf ? "PDF" : entry.file.type === "image/png" ? "PNG" : "JPG"} · {fmt(entry.file.size)}
                      {entry.rotation > 0 && ` · ${entry.rotation}°`}
                      {entry.editedBlob && " · cropped"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isPdf && <button onClick={() => openCrop(i)} title="Crop" className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"><Icon name="content_cut" size={14} /></button>}
                    <button onClick={() => rotate(i, -1)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↺</button>
                    <button onClick={() => rotate(i,  1)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↻</button>
                    <button onClick={() => setEntries(p => p.filter((_, idx) => idx !== i))} className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 transition-colors"><Icon name="close" size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 flex flex-col gap-2">
        {saved.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {saved.map(name => (
              <div key={name} className="flex items-center bg-[var(--bg-2)] border border-[var(--border)] rounded-md overflow-hidden">
                <button onClick={() => setFilename(name)} className="px-2.5 py-1 text-[0.7rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">{name}</button>
                <button onClick={() => deleteSaved(name)} className="px-1.5 py-1 text-[var(--border)] hover:text-red-400 transition-colors flex items-center"><Icon name="close" size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center border border-[var(--border)] rounded-lg bg-[var(--bg-2)] overflow-hidden">
            <input value={filename} onChange={e => setFilename(e.target.value)}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]" placeholder="Output filename" />
            <span className="pr-2 text-xs text-[var(--text-3)]">.pdf</span>
            <button onClick={saveName} title="Save filename" className="border-l border-[var(--border)] px-3 py-2.5 text-[var(--text-3)] hover:text-[var(--highlight-text)] transition-colors flex items-center"><Icon name="star_border" size={16} /></button>
          </div>
          <button onClick={handleDownload} disabled={building}
            className={cn("px-5 py-2.5 rounded-lg bg-[var(--text)] text-[var(--bg)] text-sm font-semibold whitespace-nowrap transition-all", building ? "opacity-50 cursor-not-allowed" : "hover:opacity-80")}>
            {building ? "Building..." : "↓ Download PDF"}
          </button>
        </div>
        {progress >= 0 && <div className="h-0.5 bg-[var(--border)] rounded overflow-hidden"><div className="h-full bg-[var(--highlight)] transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
        {status.msg && <p className={cn("text-[0.73rem] text-center", status.type === "error" ? "text-red-400" : status.type === "success" ? "text-[var(--highlight-text)]" : "text-[var(--text-3)]")}>{status.msg}</p>}
      </div>

      {/* Hover preview */}
      {preview && (
        <div className="fixed z-50 pointer-events-none w-48 h-48 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl overflow-hidden"
          style={{ left: preview.x + 16, top: Math.max(6, preview.y - 96) }}>
          <img src={preview.src} className={cn("w-full h-full object-contain", rotClass(preview.rot))} alt="" />
        </div>
      )}

      {/* Crop modal */}
      <CropModal cropperReady={cropperReady} imgSrc={cropSrc}
        onApply={blob => {
          if (editIdx !== null) setEntries(prev => prev.map((e, i) => i === editIdx ? { ...e, editedBlob: blob, rotation: 0 } : e))
          setCropSrc(null); setEditIdx(null)
        }}
        onCancel={() => { setCropSrc(null); setEditIdx(null) }} />
    </>
  )
}

// ─── Tab: Compress ────────────────────────────────────────────────────────────

type Quality = "high" | "balanced" | "small"
const QUALITY: Record<Quality, { scale: number; jpeg: number; label: string; desc: string }> = {
  high:     { scale: 2.0, jpeg: 0.90, label: "High",     desc: "Best quality" },
  balanced: { scale: 1.5, jpeg: 0.78, label: "Balanced", desc: "Recommended" },
  small:    { scale: 1.2, jpeg: 0.62, label: "Small",    desc: "Smallest file" },
}

type CompressEntry = { id: number; file: File; state: "pending" | "compressing" | "done" | "error"; result?: { bytes: Uint8Array; saving: number }; error?: string }
let compressIdCtr = 0

function CompressTab({ pdfJsReady }: { pdfJsReady: boolean }) {
  const [entries, setEntries]   = useState<CompressEntry[]>([])
  const [quality, setQuality]   = useState<Quality>("balanced")
  const [running, setRunning]   = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function addFiles(files: File[]) {
    const valid = files.filter(f => f.type === "application/pdf")
    setEntries(prev => [...prev, ...valid.map(f => ({ id: ++compressIdCtr, file: f, state: "pending" as const }))])
  }

  function removeEntry(id: number) { setEntries(prev => prev.filter(e => e.id !== id)) }

  async function compressEntry(entry: CompressEntry): Promise<void> {
    const { scale, jpeg } = QUALITY[quality]
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, state: "compressing" } : e))
    try {
      const pdfjsLib = (window as any).pdfjsLib
      const buf = await entry.file.arrayBuffer()
      const pdfSrc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      const { PDFDocument } = await import("pdf-lib")
      const outDoc = await PDFDocument.create()
      for (let p = 1; p <= pdfSrc.numPages; p++) {
        const page = await pdfSrc.getPage(p)
        const vp0  = page.getViewport({ scale: 1 })
        const vp   = page.getViewport({ scale })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        const jpegBytes: ArrayBuffer = await new Promise(res => canvas.toBlob(b => b!.arrayBuffer().then(res), "image/jpeg", jpeg))
        const img = await outDoc.embedJpg(jpegBytes)
        const pw = vp0.width, ph = vp0.height
        const pg = outDoc.addPage([pw, ph])
        pg.drawImage(img, { x: 0, y: 0, width: pw, height: ph })
      }
      const outBytes = await outDoc.save({ useObjectStreams: true })
      const saving = Math.round((1 - outBytes.byteLength / entry.file.size) * 100)
      if (saving <= 0) { setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, state: "error", error: "Already fully compressed — can't shrink further." } : e)); return }
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, state: "done", result: { bytes: outBytes, saving } } : e))
    } catch (err: unknown) {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, state: "error", error: err instanceof Error ? err.message : String(err) } : e))
    }
  }

  async function compressAll() {
    if (running || !pdfJsReady) return
    const pending = entries.filter(e => e.state === "pending")
    if (!pending.length) return
    setRunning(true)
    for (const e of pending) await compressEntry(e)
    setRunning(false)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}
        onClick={() => document.getElementById("compressInput")?.click()}
        className={cn("border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-all", dragOver ? "border-[var(--highlight)] bg-[var(--highlight)]/5" : "border-[var(--border)] hover:border-[var(--text-3)] hover:bg-[var(--bg-2)]")}
      >
        <div className="text-[var(--text-3)] mb-2"><Icon name="compress" size={36} /></div>
        <p className="text-sm font-medium text-[var(--text)]">Drop PDFs here</p>
        <p className="text-xs text-[var(--text-3)] mt-1">Multiple files supported</p>
        <input id="compressInput" type="file" multiple accept=".pdf,application/pdf" className="hidden"
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
      </div>

      {/* Quality selector */}
      <div className="flex flex-col gap-2">
        <p className="label-xs">Quality</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(QUALITY) as [Quality, typeof QUALITY[Quality]][]).map(([key, q]) => (
            <button key={key} onClick={() => setQuality(key)}
              className={cn("py-2.5 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-0.5",
                quality === key
                  ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
                  : "border-[var(--border)] text-[var(--text-2)] hover:border-[var(--text-2)] hover:text-[var(--text)]"
              )}>
              {q.label}
              <span className={cn("text-[0.62rem] font-normal", quality === key ? "text-[var(--bg)]/70" : "text-[var(--text-3)]")}>{q.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      {entries.length > 0 && (
        <div className="flex gap-2">
          <button onClick={compressAll} disabled={running || !pdfJsReady}
            className={cn("flex-1 py-2.5 rounded-lg bg-[var(--text)] text-[var(--bg)] text-sm font-semibold transition-all", (running || !pdfJsReady) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80")}>
            {running ? "Compressing..." : "Compress All"}
          </button>
          <button onClick={() => setEntries([])} className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-3)] hover:text-red-400 hover:border-red-400/50 transition-colors">Clear</button>
        </div>
      )}

      {/* File list */}
      <div className="flex flex-col gap-2">
        {entries.map(entry => (
          <div key={entry.id} className={cn("border rounded-lg overflow-hidden bg-[var(--bg-2)]", entry.state === "done" ? "border-green-500/40" : entry.state === "error" ? "border-red-400/40" : "border-[var(--border)]")}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Icon name="description" size={22} className="text-[var(--text-3)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] truncate">{entry.file.name}</p>
                <p className="text-[0.65rem] text-[var(--text-3)]">{fmt(entry.file.size)}</p>
              </div>
              {entry.state === "compressing" && <span className="text-xs text-[var(--text-3)]">Compressing...</span>}
              {entry.state === "pending"     && <button onClick={() => removeEntry(entry.id)} className="text-[var(--text-3)] hover:text-red-400 transition-colors flex items-center"><Icon name="close" size={16} /></button>}
            </div>
            {entry.state === "done" && entry.result && (
              <div className="flex items-center gap-3 px-3 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
                <span className="text-xs text-[var(--text-3)] flex-1">{fmt(entry.file.size)} → {fmt(entry.result.bytes.byteLength)}</span>
                <span className="text-xs font-semibold text-green-500">-{entry.result.saving}%</span>
                <button onClick={() => triggerDownload(entry.result!.bytes, entry.file.name)}
                  className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-80 transition-opacity">
                  ↓ Download
                </button>
              </div>
            )}
            {entry.state === "error" && (
              <div className="px-3 py-2 border-t border-red-400/30 bg-red-500/5">
                <p className="text-xs text-red-400">{entry.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Docs ────────────────────────────────────────────────────────────────

const DOC_SLOTS = [
  { label: "在留カード（表）" },
  { label: "在留カード（裏）" },
  { label: "指定書" },
  { label: "パスポート" },
  { label: "営業許可証" },
  { label: "住民票" },
]

type DocEntry = { file: File | null; editedBlob: Blob | null; rotation: number }
type DocSlot  = { label: string }

function WorkerSearch({ onPickSerial, onPickName }: {
  onPickSerial: (s: string) => void
  onPickName:   (n: string) => void
}) {
  const [workers, setWorkers]       = useState<Worker[]>([])
  const [q, setQ]                   = useState("")
  const [open, setOpen]             = useState(false)
  const [serialChosen, setSerialChosen] = useState(false)
  const [nameChosen,   setNameChosen]   = useState(false)
  const suppress                    = useRef(false)

  useEffect(() => { getWorkers().then(setWorkers) }, [])

  const results = q.trim().length > 0
    ? workers.filter(w => {
        const lq = q.toLowerCase()
        return (
          (w.worker_id ?? "").toLowerCase().includes(lq) ||
          (w.payroll_post_id ?? "").includes(lq) ||
          (w.name_latin ?? "").toLowerCase().includes(lq) ||
          (w.name_kana ?? "").includes(q)
        )
      }).slice(0, 8)
    : []

  function close() { setOpen(false); setQ(""); setSerialChosen(false); setNameChosen(false) }

  function pickSerial(serial: string, currentNameChosen: boolean) {
    suppress.current = true
    onPickSerial(serial)
    setSerialChosen(true)
    if (currentNameChosen) close()
  }

  function pickName(name: string, currentSerialChosen: boolean) {
    suppress.current = true
    onPickName(name)
    setNameChosen(true)
    if (currentSerialChosen) close()
  }

  function pickBoth(serial: string, name: string) {
    onPickSerial(serial)
    onPickName(name)
    close()
  }

  const CHIP = "w-20 shrink-0 flex items-center justify-center py-2 text-[0.65rem] font-mono border-l border-[var(--border)] hover:bg-[var(--highlight)]/20 hover:text-[var(--highlight-text)] transition-colors"
  const dim  = "text-[var(--border)] pointer-events-none"

  return (
    <div className="relative">
      <input
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
        placeholder={workers.length > 0 ? `Search from ${workers.length} workers…` : "Loading workers…"}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); setSerialChosen(false); setNameChosen(false) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => {
          if (suppress.current) { suppress.current = false; return }
          setOpen(false); setSerialChosen(false); setNameChosen(false)
        }, 150)}
        autoComplete="off"
      />
      {open && q.trim().length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg overflow-hidden">
          {/* Column headers */}
          <div className="flex border-b border-[var(--border)] bg-[var(--bg-2)]">
            <div className="flex-1 px-3 py-1 text-[0.65rem] text-[var(--text-3)]" />
            {(["Romaji","カナ","I番号","給与ID"] as const).map((h, i) => (
              <div key={h} className={`w-20 shrink-0 text-center py-1 text-[0.65rem] border-l border-[var(--border)] ${i < 2 ? (nameChosen ? "text-[var(--highlight-text)]" : "text-[var(--text-3)]") : (serialChosen ? "text-[var(--highlight-text)]" : "text-[var(--text-3)]")}`}>{h}</div>
            ))}
          </div>
          {results.length === 0
            ? <p className="px-3 py-2 text-[0.75rem] text-[var(--text-3)]">No match for &ldquo;{q}&rdquo;</p>
            : results.map(w => {
                const latin = w.name_latin ?? ""
                const kana  = w.name_kana  ?? ""
                const id    = w.worker_id ?? ""
                return (
                  <div key={w.id} className="flex items-stretch border-b border-[var(--border)] last:border-0">
                    {/* Worker info — not clickable */}
                    <div className="flex-1 px-3 py-2 min-w-0">
                      <div className="text-sm text-[var(--text)] truncate">{latin || kana || "—"}</div>
                      {kana && latin && <div className="text-[0.65rem] text-[var(--text-3)] truncate">{kana}</div>}
                    </div>
                    {/* Romaji — picks name only */}
                    <button onMouseDown={() => latin ? pickName(latin, serialChosen) : undefined}
                      className={`${CHIP} ${!latin ? dim : ""}`}>
                      {latin ? "Romaji" : "—"}
                    </button>
                    {/* カナ — picks name only */}
                    <button onMouseDown={() => kana ? pickName(kana, serialChosen) : undefined}
                      className={`${CHIP} ${!kana ? dim : ""}`}>
                      {kana ? "カナ" : "—"}
                    </button>
                    {/* Worker ID — picks serial only */}
                    <button onMouseDown={() => id ? pickSerial(id, nameChosen) : undefined}
                      className={`${CHIP} ${!id ? dim : ""}`} style={{ color: id ? "var(--highlight-text)" : undefined }}>
                      {id || "—"}
                    </button>
                    {/* Payroll ID — picks serial only */}
                    <button onMouseDown={() => w.payroll_post_id ? pickSerial(w.payroll_post_id, nameChosen) : undefined}
                      className={`${CHIP} ${!w.payroll_post_id ? dim : ""}`}>
                      {w.payroll_post_id || "—"}
                    </button>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

function DocsTab({ cropperReady, pdfJsReady, serial, setSerial, name, setName }: {
  cropperReady: boolean; pdfJsReady: boolean
  serial: string; setSerial: (v: string) => void
  name: string;   setName:   (v: string) => void
}) {
  const [slots, setSlots]         = useState<DocSlot[]>(DOC_SLOTS)
  const [docs, setDocs]           = useState<DocEntry[]>(DOC_SLOTS.map(() => ({ file: null, editedBlob: null, rotation: 0 })))
  const [status, setStatus]       = useState<{ msg: string; type: "" | "error" | "success" }>({ msg: "", type: "" })
  const [progress, setProgress]   = useState(-1)
  const [building, setBuilding]   = useState(false)
  const [editIdx, setEditIdx]     = useState<number | null>(null)
  const [cropSrc, setCropSrc]     = useState<string | null>(null)
  const [activePaste, setActivePaste] = useState(-1)
  const [checked, setChecked]     = useState<boolean[]>(DOC_SLOTS.map(() => false))
  const [addingSlot, setAddingSlot]   = useState(false)
  const [newSlotLabel, setNewSlotLabel] = useState("")
  const newSlotRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (addingSlot) setTimeout(() => newSlotRef.current?.focus(), 50) }, [addingSlot])

  function addSlot() {
    const label = newSlotLabel.trim()
    if (!label) return
    setSlots(prev => [...prev, { label }])
    setDocs(prev => [...prev, { file: null, editedBlob: null, rotation: 0 }])
    setChecked(prev => [...prev, false])
    setNewSlotLabel("")
    setAddingSlot(false)
  }

  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i))
    setDocs(prev => prev.filter((_, idx) => idx !== i))
    setChecked(prev => prev.filter((_, idx) => idx !== i))
  }

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (activePaste < 0) return
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter(i => i.kind === "file").map(i => i.getAsFile())
        .filter(f => f && ["application/pdf","image/jpeg","image/png"].includes(f!.type)) as File[]
      if (files[0]) setDoc(activePaste, files[0])
    }
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  }, [activePaste])

  function getFilename(i: number) {
    const parts = [serial.trim(), name.trim(), slots[i]?.label ?? ""].filter(Boolean)
    return (parts.length === 1 ? parts[0] : parts.join("_")) + ".pdf"
  }

  function setDoc(i: number, file: File) {
    setDocs(prev => prev.map((d, idx) => idx === i ? { file, editedBlob: null, rotation: 0 } : d))
  }

  function clearDoc(i: number) {
    setDocs(prev => prev.map((d, idx) => idx === i ? { file: null, editedBlob: null, rotation: 0 } : d))
  }

  function rotateDoc(i: number, dir: 1 | -1) {
    setDocs(prev => prev.map((d, idx) => idx === i ? { ...d, rotation: (d.rotation + dir * 90 + 360) % 360 } : d))
  }

  function openCrop(i: number) {
    const d = docs[i]
    if (!d.file || d.file.type === "application/pdf") return
    setEditIdx(i)
    setCropSrc(URL.createObjectURL(d.editedBlob ?? d.file))
  }

  async function imageToBytes(blob: Blob): Promise<Uint8Array> {
    const { PDFDocument } = await import("pdf-lib")
    const url = URL.createObjectURL(blob)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onerror = reject
      img.onload = async () => {
        URL.revokeObjectURL(url)
        const maxW = 595, maxH = 842
        const s = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
        const pw = Math.round(img.naturalWidth * s), ph = Math.round(img.naturalHeight * s)
        const canvas = document.createElement("canvas")
        canvas.width = pw * 2; canvas.height = ph * 2
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const jpgBytes: ArrayBuffer = await new Promise(res => canvas.toBlob(b => b!.arrayBuffer().then(res), "image/jpeg", 0.9))
        const doc = await PDFDocument.create()
        const emb = await doc.embedJpg(jpgBytes)
        const pg  = doc.addPage([pw, ph])
        pg.drawImage(emb, { x: 0, y: 0, width: pw, height: ph })
        resolve(await doc.save({ useObjectStreams: true }))
      }
      img.src = url
    })
  }

  async function pdfToBytes(file: File): Promise<Uint8Array> {
    const pdfjsLib = (window as any).pdfjsLib
    const buf    = await file.arrayBuffer()
    const pdfSrc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
    const { PDFDocument } = await import("pdf-lib")
    const outDoc = await PDFDocument.create()
    for (let p = 1; p <= pdfSrc.numPages; p++) {
      const page = await pdfSrc.getPage(p)
      const vp0  = page.getViewport({ scale: 1 })
      const vp   = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      const jpegBytes: ArrayBuffer = await new Promise(res => canvas.toBlob(b => b!.arrayBuffer().then(res), "image/jpeg", 0.82))
      const img = await outDoc.embedJpg(jpegBytes)
      const s = Math.min(1, 595 / img.width, 842 / img.height)
      const w = Math.round(img.width * s), h = Math.round(img.height * s)
      const pg = outDoc.addPage([w, h])
      pg.drawImage(img, { x: 0, y: 0, width: w, height: h })
    }
    return outDoc.save({ useObjectStreams: true })
  }

  async function downloadDoc(i: number) {
    const d = docs[i]
    if (!d.file) return
    let src: Blob = d.editedBlob ?? d.file
    if (d.file.type !== "application/pdf" && d.rotation !== 0)
      src = new Blob([await rotateImageToJpeg(src, d.rotation)], { type: "image/jpeg" })
    const bytes = d.file.type === "application/pdf" ? await pdfToBytes(d.file) : await imageToBytes(src)
    triggerDownload(bytes, getFilename(i))
  }

  async function combineSelected() {
    const selected = checked.map((c, i) => ({ c, i })).filter(({ c, i }) => c && docs[i].file)
    if (!selected.length) { setStatus({ msg: "Check at least one loaded doc to combine.", type: "error" }); return }
    setBuilding(true); setProgress(0); setStatus({ msg: "Combining...", type: "" })
    try {
      const { PDFDocument } = await import("pdf-lib")
      const outDoc = await PDFDocument.create()
      for (let n = 0; n < selected.length; n++) {
        const i = selected[n].i
        const d = docs[i]
        setProgress(Math.round((n / selected.length) * 90))
        let imgSrc: Blob = d.editedBlob ?? d.file!
        if (d.file!.type !== "application/pdf" && d.rotation !== 0)
          imgSrc = new Blob([await rotateImageToJpeg(imgSrc, d.rotation)], { type: "image/jpeg" })
        const bytes = d.file!.type === "application/pdf" ? await pdfToBytes(d.file!) : await imageToBytes(imgSrc)
        const srcDoc = await PDFDocument.load(bytes)
        const pages  = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices())
        for (const p of pages) outDoc.addPage(p)
      }
      setProgress(95)
      const out   = await outDoc.save({ useObjectStreams: true })
      const selectedIndices = new Set(selected.map(({ i }) => i))
      const hasZairyuuBoth = selectedIndices.has(0) && selectedIndices.has(1)
      const docLabels: string[] = []
      if (hasZairyuuBoth) {
        docLabels.push("在留カード")
        selected.filter(({ i }) => i !== 0 && i !== 1).forEach(({ i }) => docLabels.push(slots[i]?.label ?? ""))
      } else {
        selected.forEach(({ i }) => docLabels.push(slots[i]?.label ?? ""))
      }
      const parts = [serial.trim(), name.trim(), docLabels.join("・")].filter(Boolean)
      triggerDownload(out, parts.join("_") + ".pdf")
      setProgress(100)
      setStatus({ msg: `Combined ${selected.length} docs.`, type: "success" })
      setTimeout(() => setProgress(-1), 1800)
    } catch (err: unknown) {
      setStatus({ msg: "Error: " + (err instanceof Error ? err.message : String(err)), type: "error" })
      setProgress(-1)
    } finally { setBuilding(false) }
  }

  async function downloadAll() {
    const loaded = docs.map((d, i) => ({ d, i })).filter(({ d }) => d.file)
    if (!loaded.length) { setStatus({ msg: "No files added yet.", type: "error" }); return }
    setBuilding(true); setProgress(0); setStatus({ msg: "Processing...", type: "" })
    try {
      for (let n = 0; n < loaded.length; n++) {
        const { d, i } = loaded[n]
        setStatus({ msg: `Processing ${n + 1} of ${loaded.length}...`, type: "" })
        setProgress(Math.round((n / loaded.length) * 100))
        let imgSrc2: Blob = d.editedBlob ?? d.file!
        if (d.file!.type !== "application/pdf" && d.rotation !== 0)
          imgSrc2 = new Blob([await rotateImageToJpeg(imgSrc2, d.rotation)], { type: "image/jpeg" })
        const bytes = d.file!.type === "application/pdf" ? await pdfToBytes(d.file!) : await imageToBytes(imgSrc2)
        triggerDownload(bytes, getFilename(i))
      }
      setProgress(100)
      setStatus({ msg: `Downloaded ${loaded.length} file${loaded.length > 1 ? "s" : ""}.`, type: "success" })
      setTimeout(() => setProgress(-1), 1800)
    } catch (err: unknown) {
      setStatus({ msg: "Error: " + (err instanceof Error ? err.message : String(err)), type: "error" })
      setProgress(-1)
    } finally { setBuilding(false) }
  }

  return (
    <>
      {/* Header — outside overflow-y-auto so the search dropdown is never clipped */}
      <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex flex-col gap-3">
        <div>
          <p className="label-xs mb-1.5">Search worker</p>
          <WorkerSearch onPickSerial={setSerial} onPickName={setName} />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="label-xs">Serial No.</label>
            <input value={serial} onChange={e => setSerial(e.target.value)} placeholder="e.g. I2"
              className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors placeholder:text-[var(--text-3)]" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="label-xs">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 田中太郎"
              className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors placeholder:text-[var(--text-3)]" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

        {/* Slots */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {slots.map((slot, i) => {
            const d = docs[i]
            const isImg = d.file && d.file.type !== "application/pdf"
            const isCustom = i >= DOC_SLOTS.length
            return (
              <div key={i} className={cn("border rounded-lg overflow-hidden bg-[var(--bg-2)]", checked[i] ? "border-[var(--highlight)]" : "border-[var(--border)]")}>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
                  <input type="checkbox" checked={checked[i]} onChange={e => setChecked(prev => prev.map((v, idx) => idx === i ? e.target.checked : v))}
                    className="w-3.5 h-3.5 shrink-0 accent-[var(--highlight)] cursor-pointer" title="Include in combined PDF" />
                  <span className="text-sm font-semibold text-[var(--text)] flex-1">{slot.label}</span>
                  <span className="text-[0.62rem] text-[var(--text-3)] font-mono truncate max-w-[120px]">{getFilename(i)}</span>
                  {isCustom && (
                    <button onClick={() => removeSlot(i)} className="text-[var(--text-3)] hover:text-red-400 transition-colors shrink-0 flex items-center" title="Remove this slot"><Icon name="close" size={14} /></button>
                  )}
                </div>

                {d.file ? (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-10 h-10 rounded bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                      {isImg
                        ? <img src={URL.createObjectURL(d.editedBlob ?? d.file!)} className={cn("w-full h-full object-cover", rotClass(d.rotation))} alt="" />
                        : <Icon name="description" size={22} className="text-[var(--text-3)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text)] truncate">{d.file.name}</p>
                      <p className="text-[0.65rem] text-[var(--text-3)]">
                        {fmt(d.file.size)}
                        {d.editedBlob ? " · cropped" : ""}
                        {d.rotation ? ` · ${d.rotation}°` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isImg && <button onClick={() => openCrop(i)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"><Icon name="content_cut" size={14} /></button>}
                      <button onClick={() => rotateDoc(i, -1)} title="Rotate left" className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↺</button>
                      <button onClick={() => rotateDoc(i,  1)} title="Rotate right" className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↻</button>
                      <button onClick={() => downloadDoc(i)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">↓</button>
                      <button onClick={() => clearDoc(i)} className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 transition-colors"><Icon name="close" size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div
                    tabIndex={0}
                    onFocus={() => setActivePaste(i)}
                    onBlur={() => setActivePaste(-1)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find(f => ["application/pdf","image/jpeg","image/png"].includes(f.type)); if (f) setDoc(i, f) }}
                    className="px-3 py-4 text-center cursor-default hover:bg-[var(--bg)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--highlight)]"
                  >
                    <p className="text-xs text-[var(--text-3)]">
                      Drop · paste (Ctrl+V) · or{" "}
                      <span
                        className="text-[var(--highlight-text)] underline cursor-pointer"
                        onClick={e => { e.stopPropagation(); document.getElementById(`doc-input-${i}`)?.click() }}
                      >browse</span>
                    </p>
                  </div>
                )}
                <input id={`doc-input-${i}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setDoc(i, e.target.files[0]); e.target.value = "" }} />
              </div>
            )
          })}

          {/* Add new doc type */}
          {addingSlot ? (
            <div className="flex gap-2 items-center">
              <input ref={newSlotRef} value={newSlotLabel} onChange={e => setNewSlotLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addSlot(); if (e.key === "Escape") { setAddingSlot(false); setNewSlotLabel("") } }}
                placeholder="Document type name"
                className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors" />
              <button onClick={addSlot} className="px-3 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium hover:opacity-80 transition-opacity">Add</button>
              <button onClick={() => { setAddingSlot(false); setNewSlotLabel("") }} className="px-3 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingSlot(true)}
              className="text-left text-[0.78rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
              + Add document type
            </button>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-5 py-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={downloadAll} disabled={building || !pdfJsReady} suppressHydrationWarning
            className={cn("flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm font-semibold transition-all text-[var(--text-2)]", (building || !pdfJsReady) ? "opacity-50 cursor-not-allowed" : "hover:text-[var(--text)] hover:border-[var(--text-2)]")}>
            {building ? "Processing..." : "↓ Download All"}
          </button>
          <button onClick={combineSelected} suppressHydrationWarning disabled={building || !pdfJsReady || !checked.some((c, i) => c && !!docs[i].file)}
            className={cn("flex-1 py-2.5 rounded-lg bg-[var(--text)] text-[var(--bg)] text-sm font-semibold transition-all",
              (building || !pdfJsReady || !checked.some((c, i) => c && !!docs[i].file)) ? "opacity-40 cursor-not-allowed" : "hover:opacity-80")}>
            {building ? "Combining..." : `Combine${checked.filter((c, i) => c && !!docs[i].file).length > 0 ? ` (${checked.filter((c, i) => c && !!docs[i].file).length})` : ""}`}
          </button>
        </div>
        {progress >= 0 && <div className="h-0.5 bg-[var(--border)] rounded overflow-hidden"><div className="h-full bg-[var(--highlight)] transition-all duration-300" style={{ width: `${progress}%` }} /></div>}
        {status.msg && <p className={cn("text-[0.73rem] text-center", status.type === "error" ? "text-red-400" : status.type === "success" ? "text-[var(--highlight-text)]" : "text-[var(--text-3)]")}>{status.msg}</p>}
      </div>

      <CropModal cropperReady={cropperReady} imgSrc={cropSrc}
        onApply={blob => {
          if (editIdx !== null) setDocs(prev => prev.map((d, i) => i === editIdx ? { ...d, editedBlob: blob } : d))
          setCropSrc(null); setEditIdx(null)
        }}
        onCancel={() => { setCropSrc(null); setEditIdx(null) }} />
    </>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

type Tab = "merge" | "compress" | "docs"

export default function PDFPage() {
  const [tab, setTab]                   = useState<Tab>("docs")
  const [cropperReady, setCropperReady] = useState(false)
  const [pdfJsReady, setPdfJsReady]     = useState(false)
  const [serial, setSerial]             = useState("")
  const [name, setName]                 = useState("")

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js" onReady={() => setCropperReady(true)} />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        onReady={() => {
          ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          setPdfJsReady(true)
        }} />

      <div className="flex flex-col h-[calc(100dvh-48px)]">

        <PageHeader title="PDF" right={
          <PillTabs
            options={[
              { value: "docs"     as Tab, label: "Docs" },
              { value: "merge"    as Tab, label: "Merge" },
              { value: "compress" as Tab, label: "Compress" },
            ]}
            value={tab}
            onChange={setTab}
          />
        } />

        <ToolContent>
          {tab === "merge"    && <MergeTab    cropperReady={cropperReady} />}
          {tab === "compress" && <CompressTab pdfJsReady={pdfJsReady} />}
          {tab === "docs"     && <DocsTab     cropperReady={cropperReady} pdfJsReady={pdfJsReady} serial={serial} setSerial={setSerial} name={name} setName={setName} />}
        </ToolContent>
      </div>
    </>
  )
}
