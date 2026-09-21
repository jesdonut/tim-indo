"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { useT } from "@/lib/i18n"

// Rescale pages to a target paper size, keeping aspect ratio (fit width OR
// height). The final canvas is exactly the target; the leftover in the other
// dimension is placed by alignment + an optional ±mm nudge, over a chosen page
// color. Settings apply to all pages by default, but any page can override them
// — and a one-click "binding" helper alternates the gutter (spine) side per page
// so left/right pages of a spread mirror correctly when bound.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

const MM = 72 / 25.4
const mm2pt = (mm: number) => mm * MM
const hexRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim())
  const n = m ? parseInt(m[1], 16) : 0xffffff
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

const SIZES: Record<string, [number, number]> = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148],
  "B4 (JIS)": [257, 364], "B5 (JIS)": [182, 257], "B6 (JIS)": [128, 182],
  "B5 (ISO)": [176, 250],
  Letter: [215.9, 279.4],
}
type Fit = "width" | "height"
type HAlign = "left" | "center" | "right"
type VAlign = "top" | "center" | "bottom"
type Settings = {
  sizeKey: string; cw: number; ch: number; orient: boolean
  fit: Fit; hAlign: HAlign; vAlign: VAlign; nudgeX: number; nudgeY: number; bg: string
}
const DEFAULTS: Settings = {
  sizeKey: "A5", cw: 148, ch: 210, orient: true,
  fit: "height", hAlign: "center", vAlign: "center", nudgeX: 0, nudgeY: 0, bg: "#ffffff",
}
type Bind = "off" | "inner" | "outer"
const THUMB_CAP = 80

export default function ResizeTab({ pdfJsReady }: { pdfJsReady: boolean }) {
  const { t } = useT()
  const [bytes, setBytes]   = useState<Uint8Array | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [dims, setDims]     = useState<{ w: number; h: number }[]>([])
  const [count, setCount]   = useState(0)
  const [fileName, setFileName] = useState("")
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState("")

  const [global, setGlobal]       = useState<Settings>(DEFAULTS)
  const [overrides, setOverrides] = useState<Record<number, Partial<Settings>>>({})
  const [sel, setSel]             = useState<number | "all">("all")
  const [bind, setBind]           = useState<Bind>("off")
  const docRef = useRef<any>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  const eff = (i: number): Settings => ({ ...global, ...(overrides[i] || {}) })

  async function loadFile(file: File) {
    if (!pdfJsReady || file.type !== "application/pdf") return
    setLoading(true); setStatus(""); setThumbs([]); setOverrides({}); setBind("off"); setSel("all")
    setFileName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setBytes(buf)
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      docRef.current = pdf
      setCount(pdf.numPages)
      const th: string[] = [], dm: { w: number; h: number }[] = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        dm[p - 1] = { w: page.getViewport({ scale: 1 }).width, h: page.getViewport({ scale: 1 }).height }
        if (p <= THUMB_CAP) {
          const vp = page.getViewport({ scale: 0.5 })
          const canvas = document.createElement("canvas")
          canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
          const ctx = canvas.getContext("2d")!
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          th.push(canvas.toDataURL("image/jpeg", 0.7))
        }
      }
      setDims(dm); setThumbs(th)
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setLoading(false) }
  }

  // Hi-res render of the selected page for the large preview.
  useEffect(() => {
    const idx = sel === "all" ? 0 : sel
    if (!docRef.current || !dims[idx]) { setPreviewSrc(null); return }
    let cancelled = false
    setPreviewSrc(null)
    ;(async () => {
      try {
        const page = await docRef.current.getPage(idx + 1)
        const vp = page.getViewport({ scale: 1.6 })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        if (!cancelled) setPreviewSrc(canvas.toDataURL("image/jpeg", 0.85))
      } catch { /* keep thumbnail fallback */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, bytes, dims.length])

  // Edit the current scope (all pages, or the selected page as an override).
  function update(patch: Partial<Settings>) {
    if (sel === "all") setGlobal(g => ({ ...g, ...patch }))
    else setOverrides(o => ({ ...o, [sel]: { ...(o[sel] || {}), ...patch } }))
  }
  function resetPage() {
    if (sel === "all") return
    setOverrides(o => { const n = { ...o }; delete n[sel]; return n })
  }

  // Binding helper: alternate horizontal gutter side per page. Page 1 (index 0)
  // is a recto (spine on the left); "inner" puts the extra toward the spine.
  function applyBind(mode: Bind) {
    setBind(mode)
    setOverrides(prev => {
      const next: Record<number, Partial<Settings>> = {}
      for (let i = 0; i < count; i++) {
        const cur = { ...(prev[i] || {}) }
        if (mode === "off") delete cur.hAlign
        else {
          const recto = i % 2 === 0
          cur.hAlign = mode === "inner" ? (recto ? "left" : "right") : (recto ? "right" : "left")
        }
        if (Object.keys(cur).length) next[i] = cur
      }
      return next
    })
  }

  function targetPts(s: Settings, sw: number, sh: number): [number, number] {
    let tw = mm2pt(s.cw), th = mm2pt(s.ch)
    if (s.orient && sw > sh !== tw > th) [tw, th] = [th, tw]
    return [tw, th]
  }
  function place(s: Settings, sw: number, sh: number, tw: number, th: number) {
    const scale = s.fit === "width" ? tw / sw : th / sh
    const cw = sw * scale, ch = sh * scale
    let x = s.hAlign === "left" ? 0 : s.hAlign === "right" ? tw - cw : (tw - cw) / 2
    let y = s.vAlign === "bottom" ? 0 : s.vAlign === "top" ? th - ch : (th - ch) / 2
    x += mm2pt(s.nudgeX); y += mm2pt(s.nudgeY)
    return { cw, ch, x, y }
  }

  async function download() {
    if (!bytes) return
    setBusy(true); setStatus(t("pdf.creating"))
    try {
      const { PDFDocument, rgb } = await import("pdf-lib")
      const src = await PDFDocument.load(bytes)
      const pages = src.getPages()
      const out = await PDFDocument.create()
      const embeds = await out.embedPages(pages)
      for (let i = 0; i < pages.length; i++) {
        const s = eff(i)
        const emb = embeds[i]
        const [tw, th] = targetPts(s, emb.width, emb.height)
        const page = out.addPage([tw, th])
        const c = hexRgb(s.bg)
        page.drawRectangle({ x: 0, y: 0, width: tw, height: th, color: rgb(c.r, c.g, c.b) })
        const { cw, ch, x, y } = place(s, emb.width, emb.height, tw, th)
        page.drawPage(emb, { x, y, width: cw, height: ch })
      }
      const outBytes = await out.save()
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = (fileName.replace(/\.pdf$/i, "") || "resized") + "-resized.pdf"
      a.click(); URL.revokeObjectURL(url)
      setStatus(`${pages.length} ${t("pdf.pagesSaved")}`)
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setBusy(false) }
  }

  // ── empty state ──
  if (!bytes) {
    return (
      <div className="p-5 max-w-xl">
        <p className="text-[0.82rem] text-[var(--text-2)] mb-3">{t("resize.intro")}</p>
        <label className={cn(
          "block border-2 border-dashed border-[var(--border)] rounded-lg px-6 py-12 text-center transition-colors",
          pdfJsReady ? "cursor-pointer hover:border-[var(--text-2)]" : "opacity-50 cursor-not-allowed"
        )}>
          <Icon name="aspect_ratio" size={30} className="mx-auto text-[var(--text-3)] mb-2" />
          <p className="text-sm text-[var(--text-2)]">{loading ? t("common.loading") : t("pdf.pagesSelect")}</p>
          <input type="file" accept="application/pdf" className="hidden" disabled={!pdfJsReady || loading}
            onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
        </label>
        {status && <p className="mt-3 text-[0.78rem] text-red-400">{status}</p>}
      </div>
    )
  }

  const selPage = sel === "all" ? 0 : sel
  const s = sel === "all" ? global : eff(sel)
  const d = dims[selPage] ?? { w: 1, h: 1 }
  const [tw, th] = targetPts(s, d.w, d.h)
  const g = place(s, d.w, d.h, tw, th)
  const gapW = tw - g.cw, gapH = th - g.ch
  const pt2mm = (p: number) => p / MM

  // content position as % of the target frame (y flipped: PDF origin is bottom)
  const leftPct = (g.x / tw) * 100
  const topPct  = ((th - (g.y + g.ch)) / th) * 100
  const wPct    = (g.cw / tw) * 100
  const hPct    = (g.ch / th) * 100
  const previewImg = previewSrc ?? thumbs[selPage] ?? null

  const seg = (val: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick}
      className={cn("px-2.5 py-1 text-[0.72rem] transition-colors", active ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
      {val}
    </button>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-wrap">
        <span className="text-[0.75rem] text-[var(--text-3)] truncate max-w-[180px]">{fileName}</span>
        <span className="text-[0.72rem] text-[var(--text-2)]">{count} {t("pdf.pagesCount")}</span>
        <button onClick={() => { setBytes(null); setThumbs([]) }}
          className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("pdf.anotherPdf")}</button>
        {/* binding helper */}
        <div className="flex items-center gap-1.5">
          <span className="text-[0.72rem] text-[var(--text-3)]">{t("resize.binding")}</span>
          <div className="flex rounded border border-[var(--border)] overflow-hidden">
            {seg(t("resize.bindOff"),   bind === "off",   () => applyBind("off"))}
            {seg(t("resize.bindInner"), bind === "inner", () => applyBind("inner"))}
            {seg(t("resize.bindOuter"), bind === "outer", () => applyBind("outer"))}
          </div>
        </div>
        <button onClick={download} disabled={busy}
          className="ml-auto px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
          {busy ? "…" : "↓ " + t("common.download")}
        </button>
      </div>
      {status && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-[var(--text-2)]">{status}</p>}

      <div className="flex-1 min-h-0 flex">
        {/* page rail */}
        <div className="w-[120px] shrink-0 overflow-y-auto border-r border-[var(--border)] p-2 flex flex-col gap-1.5">
          <button onClick={() => setSel("all")}
            className={cn("text-[0.72rem] py-1.5 rounded border transition-colors",
              sel === "all" ? "bg-[var(--text)] text-[var(--bg)] border-[var(--text)]" : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]")}>
            {t("resize.allPages")}
          </button>
          {Array.from({ length: Math.min(count, THUMB_CAP) }, (_, i) => (
            <button key={i} onClick={() => setSel(i)}
              className={cn("relative rounded overflow-hidden border bg-white", sel === i ? "ring-2 ring-[var(--text)] border-[var(--text)]" : "border-[var(--border)]")}
              style={{ aspectRatio: "3 / 4" }}>
              {thumbs[i]
                ? <img src={thumbs[i]} alt="" className="w-full h-full object-contain" />
                : <span className="text-[var(--text-3)] text-[0.55rem]">{i + 1}</span>}
              <span className="absolute bottom-0.5 right-0.5 bg-black/55 text-white text-[0.5rem] rounded px-1">{i + 1}</span>
              {overrides[i] && <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-[var(--highlight-text)]" title={t("resize.perPage")} />}
            </button>
          ))}
        </div>

        {/* controls + preview */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="lg:w-80 shrink-0 flex flex-col gap-4 overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <p className="label-xs">{sel === "all" ? t("resize.allPages") : `${t("resize.page")} ${sel + 1}`}</p>
              {sel !== "all" && overrides[sel] && (
                <button onClick={resetPage} className="text-[0.7rem] text-[var(--text-3)] hover:text-red-400">{t("resize.resetPage")}</button>
              )}
            </div>

            <div>
              <p className="label-xs mb-1">{t("resize.target")}</p>
              <select value={s.sizeKey}
                onChange={e => {
                  const k = e.target.value
                  if (k === "custom") update({ sizeKey: "custom" })
                  else update({ sizeKey: k, cw: SIZES[k][0], ch: SIZES[k][1] })
                }}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]">
                {Object.keys(SIZES).map(k => <option key={k} value={k}>{k}</option>)}
                <option value="custom">{t("resize.custom")}</option>
              </select>
              {s.sizeKey === "custom" && (
                <div className="flex items-center gap-2 mt-2 text-[0.78rem]">
                  <input type="number" value={s.cw} onChange={e => update({ cw: +e.target.value })}
                    className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                  <span className="text-[var(--text-3)]">×</span>
                  <input type="number" value={s.ch} onChange={e => update({ ch: +e.target.value })}
                    className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                  <span className="text-[var(--text-3)]">mm</span>
                </div>
              )}
              <label className="flex items-center gap-2 mt-2 text-[0.76rem] text-[var(--text-2)]">
                <input type="checkbox" checked={s.orient} onChange={e => update({ orient: e.target.checked })} />
                {t("resize.orient")}
              </label>
            </div>

            <div>
              <p className="label-xs mb-1">{t("pdf.pageColor")}</p>
              <div className="flex items-center gap-2">
                <input type="color" value={s.bg} onChange={e => update({ bg: e.target.value })}
                  className="w-9 h-8 rounded border border-[var(--border)] bg-[var(--bg-2)] cursor-pointer p-0.5" />
                <input value={s.bg} onChange={e => update({ bg: e.target.value })}
                  className="w-24 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                <button onClick={() => update({ bg: "#ffffff" })} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("resize.white")}</button>
              </div>
            </div>

            <div>
              <p className="label-xs mb-1">{t("resize.fit")}</p>
              <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
                {seg(t("resize.fitWidth"),  s.fit === "width",  () => update({ fit: "width" }))}
                {seg(t("resize.fitHeight"), s.fit === "height", () => update({ fit: "height" }))}
              </div>
            </div>

            <div className="flex gap-6">
              <div>
                <p className="label-xs mb-1">{t("resize.hAlign")}</p>
                <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
                  {seg("←", s.hAlign === "left",   () => update({ hAlign: "left" }))}
                  {seg("↔", s.hAlign === "center", () => update({ hAlign: "center" }))}
                  {seg("→", s.hAlign === "right",  () => update({ hAlign: "right" }))}
                </div>
              </div>
              <div>
                <p className="label-xs mb-1">{t("resize.vAlign")}</p>
                <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
                  {seg("↑", s.vAlign === "top",    () => update({ vAlign: "top" }))}
                  {seg("↕", s.vAlign === "center", () => update({ vAlign: "center" }))}
                  {seg("↓", s.vAlign === "bottom", () => update({ vAlign: "bottom" }))}
                </div>
              </div>
            </div>

            <div>
              <p className="label-xs mb-1">{t("resize.nudge")}</p>
              <div className="flex items-center gap-3 text-[0.78rem]">
                <label className="flex items-center gap-1.5 text-[var(--text-2)]">X
                  <input type="number" step="0.1" value={s.nudgeX} onChange={e => update({ nudgeX: +e.target.value })}
                    className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" /></label>
                <label className="flex items-center gap-1.5 text-[var(--text-2)]">Y
                  <input type="number" step="0.1" value={s.nudgeY} onChange={e => update({ nudgeY: +e.target.value })}
                    className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" /></label>
                <span className="text-[var(--text-3)]">mm</span>
              </div>
            </div>

            <div className="text-[0.74rem] text-[var(--text-2)] leading-relaxed border-t border-[var(--border-soft)] pt-3">
              <div>{t("resize.source")}: {Math.round(pt2mm(d.w))}×{Math.round(pt2mm(d.h))}mm</div>
              <div>{t("resize.targetSize")}: {Math.round(pt2mm(tw))}×{Math.round(pt2mm(th))}mm</div>
              <div>{t("resize.scaled")}: {pt2mm(g.cw).toFixed(1)}×{pt2mm(g.ch).toFixed(1)}mm</div>
              <div className={cn(Math.abs(gapW) > 0.05 || Math.abs(gapH) > 0.05 ? "text-amber-500" : "text-[var(--text-3)]")}>
                {t("resize.leftover")}: X {pt2mm(gapW).toFixed(2)}mm · Y {pt2mm(gapH).toFixed(2)}mm
              </div>
            </div>
          </div>

          {/* preview — fills the pane height */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col p-5 border-l border-[var(--border)] bg-[var(--bg-2)]">
            <p className="label-xs mb-2 shrink-0">{t("zine.sheetPreview")}{sel !== "all" && ` · ${t("resize.page")} ${sel + 1}`}</p>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="relative h-full max-w-full border border-dashed border-[var(--text-3)]"
                style={{ aspectRatio: `${tw} / ${th}`, background: s.bg }}>
                {previewImg && (
                  <img src={previewImg} alt="" className="absolute object-fill shadow"
                    style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${wPct}%`, height: `${hPct}%` }} />
                )}
              </div>
            </div>
            <p className="mt-2 text-[0.68rem] text-[var(--text-3)] shrink-0">{t("resize.previewNote")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
