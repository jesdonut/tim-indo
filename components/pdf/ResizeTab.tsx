"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { useT } from "@/lib/i18n"

// Rescale every page to a target paper size, keeping aspect ratio (scale to fit
// width OR height). The final canvas is exactly the target size; the leftover in
// the other dimension is placed by alignment + an optional ±mm nudge, so you
// decide which side gets the extra (or which side gets cropped).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

const MM = 72 / 25.4              // mm → points
const mm2pt = (mm: number) => mm * MM
const hexRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0xffffff
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

// Presets in mm (portrait). JIS B-series is what Japan uses; ISO B5 added
// because it is common for imported/older files (176×250).
const SIZES: Record<string, [number, number]> = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148],
  "B4 (JIS)": [257, 364], "B5 (JIS)": [182, 257], "B6 (JIS)": [128, 182],
  "B5 (ISO)": [176, 250],
  Letter: [215.9, 279.4],
}
type Fit = "width" | "height"
type HAlign = "left" | "center" | "right"
type VAlign = "top" | "center" | "bottom"

export default function ResizeTab({ pdfJsReady }: { pdfJsReady: boolean }) {
  const { t } = useT()
  const [bytes, setBytes]   = useState<Uint8Array | null>(null)
  const [thumb, setThumb]   = useState<string | null>(null)
  const [dims, setDims]     = useState<{ w: number; h: number } | null>(null) // page 1, points
  const [count, setCount]   = useState(0)
  const [fileName, setFileName] = useState("")
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState("")

  const [sizeKey, setSizeKey] = useState("A5")
  const [custom, setCustom]   = useState({ w: 148, h: 210 })
  const [orient, setOrient]   = useState(true)  // auto-match source orientation
  const [fit, setFit]         = useState<Fit>("height")
  const [hAlign, setHAlign]   = useState<HAlign>("center")
  const [vAlign, setVAlign]   = useState<VAlign>("center")
  const [nudgeX, setNudgeX]   = useState(0) // mm, + = right
  const [nudgeY, setNudgeY]   = useState(0) // mm, + = up
  const [bgColor, setBgColor] = useState("#ffffff") // fills the leftover / whole canvas

  async function loadFile(file: File) {
    if (!pdfJsReady || file.type !== "application/pdf") return
    setLoading(true); setStatus(""); setThumb(null)
    setFileName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setBytes(buf)
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      setCount(pdf.numPages)
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      setDims({ w: base.width, h: base.height })
      const vp = page.getViewport({ scale: 0.7 })
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport: vp }).promise
      setThumb(canvas.toDataURL("image/jpeg", 0.75))
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setLoading(false) }
  }

  // Target size in points, oriented to match the source page when auto is on.
  function targetPts(sw: number, sh: number): [number, number] {
    const [mw, mh] = sizeKey === "custom" ? [custom.w, custom.h] : SIZES[sizeKey]
    let tw = mm2pt(mw), th = mm2pt(mh)
    if (orient && sw > sh !== tw > th) [tw, th] = [th, tw]
    return [tw, th]
  }

  // Where the scaled content sits inside the target canvas (points, y from bottom).
  function place(sw: number, sh: number, tw: number, th: number) {
    const scale = fit === "width" ? tw / sw : th / sh
    const cw = sw * scale, ch = sh * scale
    let x = hAlign === "left" ? 0 : hAlign === "right" ? tw - cw : (tw - cw) / 2
    let y = vAlign === "bottom" ? 0 : vAlign === "top" ? th - ch : (th - ch) / 2
    x += mm2pt(nudgeX); y += mm2pt(nudgeY)
    return { scale, cw, ch, x, y }
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
      const c = hexRgb(bgColor)
      for (let i = 0; i < pages.length; i++) {
        const emb = embeds[i]
        const [tw, th] = targetPts(emb.width, emb.height)
        const page = out.addPage([tw, th])
        page.drawRectangle({ x: 0, y: 0, width: tw, height: th, color: rgb(c.r, c.g, c.b) })
        const { cw, ch, x, y } = place(emb.width, emb.height, tw, th)
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

  // computed geometry for readout + preview (using page 1)
  const sw = dims?.w ?? 1, sh = dims?.h ?? 1
  const [tw, th] = targetPts(sw, sh)
  const { cw, ch, x, y } = place(sw, sh, tw, th)
  const gapW = tw - cw, gapH = th - ch
  const pt2mm = (p: number) => p / MM

  // preview box (px)
  const MAXD = 300
  const boxW = th >= tw ? MAXD * (tw / th) : MAXD
  const boxH = th >= tw ? MAXD : MAXD * (th / tw)
  const cwPx = boxW * (cw / tw), chPx = boxH * (ch / th)
  const xPx = boxW * (x / tw), topPx = boxH - boxH * (y / th) - chPx

  const seg = (label: string, val: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick}
      className={cn("px-2.5 py-1 text-[0.72rem] transition-colors", active ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
      {val || label}
    </button>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-wrap">
        <span className="text-[0.75rem] text-[var(--text-3)] truncate max-w-[200px]">{fileName}</span>
        <span className="text-[0.72rem] text-[var(--text-2)]">{count} {t("pdf.pagesCount")}</span>
        <button onClick={() => { setBytes(null); setThumb(null) }}
          className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("pdf.anotherPdf")}</button>
        <button onClick={download} disabled={busy}
          className="ml-auto px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
          {busy ? "…" : "↓ " + t("common.download")}
        </button>
      </div>
      {status && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-[var(--text-2)]">{status}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col lg:flex-row gap-8">
        {/* controls */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-4">
          <div>
            <p className="label-xs mb-1">{t("resize.target")}</p>
            <div className="flex gap-2">
              <select value={sizeKey} onChange={e => setSizeKey(e.target.value)}
                className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]">
                {Object.keys(SIZES).map(k => <option key={k} value={k}>{k}</option>)}
                <option value="custom">{t("resize.custom")}</option>
              </select>
            </div>
            {sizeKey === "custom" && (
              <div className="flex items-center gap-2 mt-2 text-[0.78rem]">
                <input type="number" value={custom.w} onChange={e => setCustom(c => ({ ...c, w: +e.target.value }))}
                  className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                <span className="text-[var(--text-3)]">×</span>
                <input type="number" value={custom.h} onChange={e => setCustom(c => ({ ...c, h: +e.target.value }))}
                  className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
                <span className="text-[var(--text-3)]">mm</span>
              </div>
            )}
            <label className="flex items-center gap-2 mt-2 text-[0.76rem] text-[var(--text-2)]">
              <input type="checkbox" checked={orient} onChange={e => setOrient(e.target.checked)} />
              {t("resize.orient")}
            </label>
          </div>

          <div>
            <p className="label-xs mb-1">{t("pdf.pageColor")}</p>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-9 h-8 rounded border border-[var(--border)] bg-[var(--bg-2)] cursor-pointer p-0.5" />
              <input value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-24 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
              <button onClick={() => setBgColor("#ffffff")} className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("resize.white")}</button>
            </div>
          </div>

          <div>
            <p className="label-xs mb-1">{t("resize.fit")}</p>
            <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
              {seg("", t("resize.fitWidth"),  fit === "width",  () => setFit("width"))}
              {seg("", t("resize.fitHeight"), fit === "height", () => setFit("height"))}
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <p className="label-xs mb-1">{t("resize.hAlign")}</p>
              <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
                {seg("", "←", hAlign === "left",   () => setHAlign("left"))}
                {seg("", "↔", hAlign === "center", () => setHAlign("center"))}
                {seg("", "→", hAlign === "right",  () => setHAlign("right"))}
              </div>
            </div>
            <div>
              <p className="label-xs mb-1">{t("resize.vAlign")}</p>
              <div className="flex rounded border border-[var(--border)] overflow-hidden w-max">
                {seg("", "↑", vAlign === "top",    () => setVAlign("top"))}
                {seg("", "↕", vAlign === "center", () => setVAlign("center"))}
                {seg("", "↓", vAlign === "bottom", () => setVAlign("bottom"))}
              </div>
            </div>
          </div>

          <div>
            <p className="label-xs mb-1">{t("resize.nudge")}</p>
            <div className="flex items-center gap-3 text-[0.78rem]">
              <label className="flex items-center gap-1.5 text-[var(--text-2)]">X
                <input type="number" step="0.1" value={nudgeX} onChange={e => setNudgeX(+e.target.value)}
                  className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" /></label>
              <label className="flex items-center gap-1.5 text-[var(--text-2)]">Y
                <input type="number" step="0.1" value={nudgeY} onChange={e => setNudgeY(+e.target.value)}
                  className="w-20 rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[var(--text)] outline-none focus:border-[var(--text-2)]" /></label>
              <span className="text-[var(--text-3)]">mm</span>
            </div>
          </div>

          {/* readout */}
          <div className="text-[0.74rem] text-[var(--text-2)] leading-relaxed border-t border-[var(--border-soft)] pt-3">
            <div>{t("resize.source")}: {Math.round(pt2mm(sw))}×{Math.round(pt2mm(sh))}mm</div>
            <div>{t("resize.targetSize")}: {Math.round(pt2mm(tw))}×{Math.round(pt2mm(th))}mm</div>
            <div>{t("resize.scaled")}: {pt2mm(cw).toFixed(1)}×{pt2mm(ch).toFixed(1)}mm</div>
            <div className={cn(Math.abs(gapW) > 0.05 || Math.abs(gapH) > 0.05 ? "text-amber-500" : "text-[var(--text-3)]")}>
              {t("resize.leftover")}: X {pt2mm(gapW).toFixed(2)}mm · Y {pt2mm(gapH).toFixed(2)}mm
            </div>
          </div>
        </div>

        {/* preview */}
        <div className="flex-1 min-w-0">
          <p className="label-xs mb-2">{t("zine.sheetPreview")}</p>
          <div className="inline-block border border-[var(--border-soft)] rounded-lg p-4 bg-[var(--bg-2)]">
            <div className="relative border border-dashed border-[var(--text-3)]" style={{ width: boxW, height: boxH, background: bgColor }}>
              {thumb && (
                <img src={thumb} alt="" className="absolute object-fill shadow"
                  style={{ left: xPx, top: topPx, width: cwPx, height: chPx }} />
              )}
            </div>
          </div>
          <p className="mt-2 text-[0.68rem] text-[var(--text-3)]">{t("resize.previewNote")}</p>
        </div>
      </div>
    </div>
  )
}
