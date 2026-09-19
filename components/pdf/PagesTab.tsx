"use client"

import { useEffect, useRef, useState } from "react"
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
  const [password, setPassword] = useState("")
  const [view, setView]         = useState<"grid" | "book">("grid")

  // Lightbox preview (grid view only): index into `items` + its hi-res image.
  const [preview, setPreview]       = useState<number | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  // Book view: selected page shown large in the right pane.
  const [bookSel, setBookSel] = useState(0)
  const [bookSrc, setBookSrc] = useState<string | null>(null)
  const docRef = useRef<any>(null) // cached pdf.js document, for hi-res renders

  async function renderPage(srcIndex: number, scale: number): Promise<string> {
    const page = await docRef.current.getPage(srcIndex + 1)
    const vp = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    return canvas.toDataURL("image/jpeg", 0.85)
  }

  async function loadFile(file: File) {
    if (!pdfJsReady || file.type !== "application/pdf") return
    setLoading(true); setStatus(""); setThumbs([]); setItems([])
    setFileName(file.name); setOutName(file.name.replace(/\.pdf$/i, "") || "edited")
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setBytes(buf)
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      docRef.current = pdf
      const th: string[] = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const vp = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        th.push(canvas.toDataURL("image/jpeg", 0.7))
      }
      setThumbs(th)
      setItems(th.map((_, i) => ({ id: ++idCtr, src: i, rotation: 0 })))
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setLoading(false) }
  }

  // Render the hi-res image whenever the previewed page changes.
  useEffect(() => {
    if (preview == null || !items[preview] || !docRef.current) { setPreviewSrc(null); return }
    let cancelled = false
    setPreviewSrc(null)
    renderPage(items[preview].src, 2.0).then(src => { if (!cancelled) setPreviewSrc(src) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, items])

  // Arrow keys / Esc while the lightbox is open.
  useEffect(() => {
    if (preview == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null)
      else if (e.key === "ArrowRight") setPreview(p => (p == null ? p : Math.min(items.length - 1, p + 1)))
      else if (e.key === "ArrowLeft")  setPreview(p => (p == null ? p : Math.max(0, p - 1)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [preview, items.length])

  // Keep the book selection in range as pages are added/removed.
  useEffect(() => {
    if (bookSel > items.length - 1) setBookSel(Math.max(0, items.length - 1))
  }, [items.length, bookSel])

  // Render the hi-res image for the book view's right pane.
  useEffect(() => {
    if (view !== "book" || !items[bookSel] || !docRef.current) { setBookSrc(null); return }
    let cancelled = false
    setBookSrc(null)
    renderPage(items[bookSel].src, 2.0).then(src => { if (!cancelled) setBookSrc(src) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, bookSel, items])

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
      let outBytes = await out.save({ useObjectStreams: true })
      if (password.trim()) {
        const { protectPdf } = await import("./protect")
        outBytes = await protectPdf(outBytes, password)
      }
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

  // A small, editable, selectable page in the book view's left rail. Click to
  // show it large on the right; drag to reorder; hover for rotate/dup/delete.
  function miniCell(i: number, label?: string) {
    const it = items[i]
    if (!it) return <div className="w-1/2" />
    return (
      <div className="w-1/2">
        <div
          draggable
          onDragStart={() => setDragId(it.id)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(it.id)}
          className={cn(
            "group relative border rounded overflow-hidden bg-white cursor-move transition-shadow",
            dragId === it.id && "opacity-40",
            bookSel === i ? "ring-2 ring-[var(--text)] border-[var(--text)]" : "border-[var(--border)]"
          )}
          style={{ aspectRatio: "3 / 4" }}
        >
          <button onClick={() => setBookSel(i)} className="w-full h-full flex items-center justify-center">
            {thumbs[it.src]
              ? <img src={thumbs[it.src]} alt="" className="max-w-full max-h-full object-contain"
                  style={{ transform: `rotate(${it.rotation}deg)` }} />
              : <div className="text-[var(--text-3)] text-[0.6rem]">…</div>}
          </button>
          <span className="absolute bottom-0.5 right-0.5 bg-black/55 text-white text-[0.5rem] rounded px-1">{i + 1}</span>
          {label && <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[0.48rem] rounded px-1">{label}</span>}
          <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => rotate(i)}    title={t("common.rotate")}    className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"><Icon name="rotate_right" size={11} /></button>
            <button onClick={() => duplicate(i)} title={t("common.duplicate")} className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"><Icon name="content_copy" size={10} /></button>
            <button onClick={() => remove(i)}    title={t("common.delete")}    className="w-5 h-5 flex items-center justify-center rounded bg-black/60 text-white hover:bg-red-500"><Icon name="close" size={11} /></button>
          </div>
        </div>
      </div>
    )
  }

  // Book view = 20/80 split: left rail shows reader spreads (cover alone, pairs,
  // back alone), right pane shows the selected page full-size. No lightbox here.
  function bookView() {
    const n = items.length
    const mid: number[] = []
    for (let i = 1; i <= n - 2; i++) mid.push(i)
    const pairs: number[][] = []
    for (let i = 0; i < mid.length; i += 2) pairs.push(mid.slice(i, i + 2))
    const sel = items[bookSel]
    return (
      <div className="flex h-full min-h-0">
        {/* left rail — the pages */}
        <div className="w-1/5 min-w-[140px] max-w-[280px] shrink-0 overflow-y-auto border-r border-[var(--border)] p-3">
          <div className="flex flex-col gap-2">
            <div className="flex justify-center">{miniCell(0, t("pdf.cover"))}</div>
            {pairs.map((pair, k) => (
              <div key={k} className="flex gap-px">
                {miniCell(pair[0])}
                {pair.length > 1 ? miniCell(pair[1]) : <div className="w-1/2" />}
              </div>
            ))}
            {n > 1 && <div className="flex justify-center">{miniCell(n - 1, t("pdf.backCover"))}</div>}
            <p className="text-[0.66rem] text-[var(--text-3)] text-center pt-1">{n} {t("pdf.pagesCount")}</p>
          </div>
        </div>
        {/* right pane — full view of the selected page */}
        <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-2)]">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
            <button onClick={() => setBookSel(s => Math.max(0, s - 1))} disabled={bookSel === 0}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-2)] disabled:opacity-30"><Icon name="chevron_left" size={18} /></button>
            <span className="text-[0.75rem] text-[var(--text-2)] tabular-nums">{items.length ? bookSel + 1 : 0} / {items.length}</span>
            <button onClick={() => setBookSel(s => Math.min(items.length - 1, s + 1))} disabled={bookSel >= items.length - 1}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-2)] disabled:opacity-30"><Icon name="chevron_right" size={18} /></button>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => rotate(bookSel)}    title={t("common.rotate")}    disabled={!sel} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-2)] disabled:opacity-30"><Icon name="rotate_right" size={15} /></button>
              <button onClick={() => duplicate(bookSel)} title={t("common.duplicate")} disabled={!sel} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-2)] disabled:opacity-30"><Icon name="content_copy" size={14} /></button>
              <button onClick={() => remove(bookSel)}    title={t("common.delete")}    disabled={!sel} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-2)] hover:text-red-400 disabled:opacity-30"><Icon name="close" size={16} /></button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-6">
            {sel && bookSrc
              ? <img src={bookSrc} alt="" className="max-w-full max-h-full object-contain shadow-lg"
                  style={{ transform: `rotate(${sel.rotation}deg)` }} />
              : <div className="text-[var(--text-3)] text-sm">{t("common.loading")}</div>}
          </div>
        </div>
      </div>
    )
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

        {/* grid / book view toggle */}
        <div className="flex rounded border border-[var(--border)] overflow-hidden">
          {(["grid", "book"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-2.5 py-1 text-[0.72rem] transition-colors",
                view === v ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
              {v === "grid" ? t("pdf.viewGrid") : t("pdf.viewBook")}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t("pdf.passwordPlaceholder")} title={t("pdf.password")} autoComplete="new-password"
            className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] w-44" />
          <input value={outName} onChange={e => setOutName(e.target.value)}
            className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] w-36" />
          <span className="text-[0.72rem] text-[var(--text-3)]">.pdf</span>
          <button onClick={download} disabled={busy || items.length === 0}
            className="px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
            {busy ? "…" : "↓ " + t("common.download")}
          </button>
        </div>
      </div>
      {status && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-[var(--text-2)]">{status}</p>}

      {/* content: editable grid (with lightbox) OR book split view */}
      <div className="flex-1 min-h-0">
        {view === "grid" ? (
          <div className="h-full overflow-y-auto p-5">
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
                  <button
                    onClick={() => setPreview(i)}
                    title={t("common.zoom")}
                    className="w-full aspect-[3/4] flex items-center justify-center bg-white overflow-hidden cursor-zoom-in">
                    {thumbs[it.src]
                      ? <img src={thumbs[it.src]} alt="" className="max-w-full max-h-full object-contain transition-transform"
                          style={{ transform: `rotate(${it.rotation}deg)` }} />
                      : <div className="text-[var(--text-3)] text-xs">…</div>}
                  </button>
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[0.62rem] rounded px-1.5 py-0.5">{i + 1}</div>
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
        ) : (
          bookView()
        )}
      </div>

      {/* lightbox preview */}
      {preview != null && items[preview] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          {/* close */}
          <button onClick={() => setPreview(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30">
            <Icon name="close" size={18} />
          </button>
          {/* prev */}
          <button
            onClick={e => { e.stopPropagation(); setPreview(p => (p == null ? p : Math.max(0, p - 1))) }}
            disabled={preview === 0}
            className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20">
            <Icon name="chevron_left" size={22} />
          </button>
          {/* image */}
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {previewSrc
              ? <img src={previewSrc} alt="" className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl transition-transform"
                  style={{ transform: `rotate(${items[preview].rotation}deg)` }} />
              : <div className="text-white/70 text-sm">{t("common.loading")}</div>}
          </div>
          {/* next */}
          <button
            onClick={e => { e.stopPropagation(); setPreview(p => (p == null ? p : Math.min(items.length - 1, p + 1))) }}
            disabled={preview === items.length - 1}
            className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-20">
            <Icon name="chevron_right" size={22} />
          </button>
          {/* counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-[0.8rem] bg-white/10 rounded-full px-3 py-1">
            {preview + 1} / {items.length}
          </div>
        </div>
      )}
    </div>
  )
}
