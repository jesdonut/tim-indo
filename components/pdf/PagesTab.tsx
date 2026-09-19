"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { useT } from "@/lib/i18n"

// Page-level editor for a single existing PDF: reorder (drag), duplicate,
// delete, rotate. Thumbnails come from pdf.js (loaded on the PDF page via CDN);
// the rebuilt file is assembled with pdf-lib. Fully client-side.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

type Item = { id: number; src: number; rotation: number } // src = original page index
let idCtr = 0

export default function PagesTab({ pdfJsReady }: { pdfJsReady: boolean }) {
  const { t } = useT()
  const [bytes, setBytes]   = useState<Uint8Array | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])   // one dataURL per original page
  const [items, setItems]   = useState<Item[]>([])
  const [fileName, setFileName] = useState("")
  const [outName, setOutName]   = useState("edited")
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState("")
  const [dragId, setDragId]     = useState<number | null>(null)

  async function loadFile(file: File) {
    if (!pdfJsReady || file.type !== "application/pdf") return
    setLoading(true); setStatus(""); setThumbs([]); setItems([])
    setFileName(file.name); setOutName(file.name.replace(/\.pdf$/i, "") || "edited")
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setBytes(buf)
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      const t: string[] = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const vp = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        t.push(canvas.toDataURL("image/jpeg", 0.7))
      }
      setThumbs(t)
      setItems(t.map((_, i) => ({ id: ++idCtr, src: i, rotation: 0 })))
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setLoading(false) }
  }

  const duplicate = (i: number) => setItems(prev => {
    const copy = { ...prev[i], id: ++idCtr }
    return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
  })
  const remove   = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const rotate   = (i: number) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, rotation: (it.rotation + 90) % 360 } : it))

  function onDrop(targetId: number) {
    if (dragId == null || dragId === targetId) return
    setItems(prev => {
      const from = prev.findIndex(x => x.id === dragId)
      const to   = prev.findIndex(x => x.id === targetId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDragId(null)
  }

  async function download() {
    if (!bytes || items.length === 0) return
    setBusy(true); setStatus(t("pdf.creating"))
    try {
      const { PDFDocument, degrees } = await import("pdf-lib")
      const src = await PDFDocument.load(bytes)
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, items.map(i => i.src))
      copied.forEach((pg, k) => {
        const rot = items[k].rotation
        if (rot) pg.setRotation(degrees((pg.getRotation().angle + rot) % 360))
        out.addPage(pg)
      })
      const outBytes = await out.save({ useObjectStreams: true })
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = (outName.trim() || "edited").replace(/\.pdf$/i, "") + ".pdf"
      a.click(); URL.revokeObjectURL(url)
      setStatus(`${items.length} ${t("pdf.pagesSaved")}`)
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setBusy(false) }
  }

  // ── empty state: load a PDF ──
  if (!bytes) {
    return (
      <div className="p-5">
        <label className={cn(
          "block border-2 border-dashed border-[var(--border)] rounded-lg px-6 py-12 text-center transition-colors",
          pdfJsReady ? "cursor-pointer hover:border-[var(--text-2)]" : "opacity-50 cursor-not-allowed"
        )}>
          <Icon name="picture_as_pdf" size={30} className="mx-auto text-[var(--text-3)] mb-2" />
          <p className="text-sm text-[var(--text-2)]">{loading ? t("common.loading") : t("pdf.pagesSelect")}</p>
          <input type="file" accept="application/pdf" className="hidden" disabled={!pdfJsReady || loading}
            onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
        </label>
        {status && <p className="mt-3 text-[0.78rem] text-red-400">{status}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-wrap">
        <span className="text-[0.75rem] text-[var(--text-3)] truncate max-w-[220px]">{fileName}</span>
        <span className="text-[0.72rem] text-[var(--text-2)]">{items.length} {t("pdf.pagesCount")}</span>
        <button onClick={() => { setBytes(null); setItems([]); setThumbs([]) }}
          className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("pdf.anotherPdf")}</button>
        <div className="ml-auto flex items-center gap-2">
          <input value={outName} onChange={e => setOutName(e.target.value)}
            className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] w-40" />
          <span className="text-[0.72rem] text-[var(--text-3)]">.pdf</span>
          <button onClick={download} disabled={busy || items.length === 0}
            className="px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
            {busy ? "…" : "↓ " + t("common.download")}
          </button>
        </div>
      </div>
      {status && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-[var(--text-2)]">{status}</p>}

      {/* thumbnail grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))" }}>
          {items.map((it, i) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => setDragId(it.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(it.id)}
              className={cn(
                "group relative border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-2)] cursor-move",
                dragId === it.id && "opacity-40"
              )}
            >
              <div className="aspect-[3/4] flex items-center justify-center bg-white overflow-hidden">
                {thumbs[it.src]
                  ? <img src={thumbs[it.src]} alt="" className="max-w-full max-h-full object-contain transition-transform"
                      style={{ transform: `rotate(${it.rotation}deg)` }} />
                  : <div className="text-[var(--text-3)] text-xs">…</div>}
              </div>
              {/* position number */}
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[0.62rem] rounded px-1.5 py-0.5">{i + 1}</div>
              {/* actions */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => rotate(i)}    title={t("common.rotate")}    className="w-6 h-6 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"><Icon name="rotate_right" size={13} /></button>
                <button onClick={() => duplicate(i)} title={t("common.duplicate")} className="w-6 h-6 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"><Icon name="content_copy" size={12} /></button>
                <button onClick={() => remove(i)}    title={t("common.delete")}    className="w-6 h-6 flex items-center justify-center rounded bg-black/60 text-white hover:bg-red-500"><Icon name="close" size={13} /></button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[0.7rem] text-[var(--text-3)]">{t("pdf.reorderHint")}</p>
      </div>
    </div>
  )
}
