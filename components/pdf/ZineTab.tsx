"use client"

import { useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { useT } from "@/lib/i18n"

// Two zine formats:
//  • mini    — 8-page one-sheet zine, printed on ONE side, folded + one cut.
//              Standard imposition, top row rotated 180°:
//              top row L→R: 5 4 3 2   bottom row L→R: 6 7 8 1
//  • booklet — saddle-stitch: pages padded to a multiple of 4, printed
//              DOUBLE-sided 2-up, folded in half and stapled.
// pdf-lib embeds source pages into panels; pdf.js draws the thumbnails.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

// mini-zine: reader page (1-based) → grid cell. col 0..3 L→R; top = upper half.
const MINI_LAYOUT: { page: number; col: number; top: boolean }[] = [
  { page: 5, col: 0, top: true },
  { page: 4, col: 1, top: true },
  { page: 3, col: 2, top: true },
  { page: 2, col: 3, top: true },
  { page: 6, col: 0, top: false },
  { page: 7, col: 1, top: false },
  { page: 8, col: 2, top: false },
  { page: 1, col: 3, top: false },
]

const PAPER = {
  a4: { w: 841.89,  h: 595.28 }, // landscape, points
  a3: { w: 1190.55, h: 841.89 },
}
type Paper = keyof typeof PAPER
type Mode  = "mini" | "booklet"

const THUMB_CAP = 48

// Saddle-stitch 2-up imposition order for `n` pages (n = multiple of 4).
// Returns a flat list of page numbers, two per printed face:
// [s1front L,R, s1back L,R, s2front L,R, ...].
function bookletSequence(n: number): number[] {
  const seq: number[] = []
  let lo = 1, hi = n
  while (lo < hi) {
    seq.push(hi, lo)        // front: left = last, right = first
    seq.push(lo + 1, hi - 1) // back:  left, right
    lo += 2; hi -= 2
  }
  return seq
}

export default function ZineTab({ pdfJsReady }: { pdfJsReady: boolean }) {
  const { t } = useT()
  const [mode, setMode]     = useState<Mode>("mini")
  const [bytes, setBytes]   = useState<Uint8Array | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([]) // up to THUMB_CAP pages
  const [count, setCount]   = useState(0)            // real page count of source
  const [paper, setPaper]   = useState<Paper>("a4")
  const [fileName, setFileName] = useState("")
  const [loading, setLoading]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState("")

  async function loadFile(file: File) {
    if (!pdfJsReady || file.type !== "application/pdf") return
    setLoading(true); setStatus(""); setThumbs([])
    setFileName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setBytes(buf)
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
      setCount(pdf.numPages)
      const th: string[] = []
      for (let p = 1; p <= Math.min(THUMB_CAP, pdf.numPages); p++) {
        const page = await pdf.getPage(p)
        const vp = page.getViewport({ scale: 0.5 })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        th.push(canvas.toDataURL("image/jpeg", 0.7))
      }
      setThumbs(th)
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setLoading(false) }
  }

  // Fit an embedded page into a cell (contain) and draw it, optionally flipped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function drawInCell(sheet: any, emb: any, degrees: any, cellX: number, cellY: number, cellW: number, cellH: number, flip: boolean, margin = 8) {
    const scale = Math.min((cellW - margin * 2) / emb.width, (cellH - margin * 2) / emb.height)
    const dw = emb.width * scale, dh = emb.height * scale
    const ox = cellX + (cellW - dw) / 2, oy = cellY + (cellH - dh) / 2
    if (flip) sheet.drawPage(emb, { x: ox + dw, y: oy + dh, width: dw, height: dh, rotate: degrees(180) })
    else      sheet.drawPage(emb, { x: ox,      y: oy,      width: dw, height: dh })
  }

  async function download() {
    if (!bytes) return
    setBusy(true); setStatus(t("pdf.creating"))
    try {
      const { PDFDocument, degrees } = await import("pdf-lib")
      const src = await PDFDocument.load(bytes)
      const srcPages = src.getPages()
      const out = await PDFDocument.create()
      const embeds = await out.embedPages(srcPages)
      const { w: W, h: H } = PAPER[paper]

      if (mode === "mini") {
        const use = Math.min(8, srcPages.length)
        const sheet = out.addPage([W, H])
        const cellW = W / 4, cellH = H / 2
        for (const { page: p, col, top } of MINI_LAYOUT) {
          if (p - 1 >= use) continue
          drawInCell(sheet, embeds[p - 1], degrees, col * cellW, top ? cellH : 0, cellW, cellH, top)
        }
      } else {
        const padded = Math.max(4, Math.ceil(srcPages.length / 4) * 4)
        const seq = bookletSequence(padded)
        const cellW = W / 2, cellH = H
        for (let i = 0; i < seq.length; i += 2) {
          const sheet = out.addPage([W, H])
          const left = seq[i], right = seq[i + 1]
          if (left  - 1 < srcPages.length) drawInCell(sheet, embeds[left  - 1], degrees, 0,     0, cellW, cellH, false)
          if (right - 1 < srcPages.length) drawInCell(sheet, embeds[right - 1], degrees, cellW, 0, cellW, cellH, false)
        }
      }

      const outBytes = await out.save()
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const suffix = mode === "mini" ? "-zine" : "-booklet"
      a.href = url; a.download = (fileName.replace(/\.pdf$/i, "") || "zine") + suffix + ".pdf"
      a.click(); URL.revokeObjectURL(url)
      setStatus(t("zine.done"))
    } catch (e) {
      setStatus(t("pdf.loadError") + ": " + String(e))
    } finally { setBusy(false) }
  }

  // ── empty state ──
  if (!bytes) {
    return (
      <div className="p-5 max-w-xl">
        <p className="text-[0.82rem] text-[var(--text-2)] mb-3">{mode === "mini" ? t("zine.intro") : t("zine.bookletIntro")}</p>
        <div className="flex rounded border border-[var(--border)] overflow-hidden w-max mb-4">
          {(["mini", "booklet"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("px-3 py-1.5 text-[0.75rem] transition-colors",
                mode === m ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
              {m === "mini" ? t("zine.modeMini") : t("zine.modeBooklet")}
            </button>
          ))}
        </div>
        <label className={cn(
          "block border-2 border-dashed border-[var(--border)] rounded-lg px-6 py-12 text-center transition-colors",
          pdfJsReady ? "cursor-pointer hover:border-[var(--text-2)]" : "opacity-50 cursor-not-allowed"
        )}>
          <Icon name="auto_stories" size={30} className="mx-auto text-[var(--text-3)] mb-2" />
          <p className="text-sm text-[var(--text-2)]">{loading ? t("common.loading") : t("zine.select")}</p>
          <input type="file" accept="application/pdf" className="hidden" disabled={!pdfJsReady || loading}
            onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
        </label>
        {status && <p className="mt-3 text-[0.78rem] text-red-400">{status}</p>}
      </div>
    )
  }

  // mini-zine preview cell
  const miniCell = (page: number, top: boolean) => {
    const src = thumbs[page - 1]
    return (
      <div className={cn("relative bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden", top && "rotate-180")}
        style={{ aspectRatio: "1 / 1.414" }}>
        {src
          ? <img src={src} alt="" className="max-w-full max-h-full object-contain" />
          : <span className="text-[var(--text-3)] text-[0.6rem]">{t("zine.blank")}</span>}
        <span className="absolute bottom-0.5 right-1 text-[0.55rem] text-[var(--text-3)] bg-white/80 rounded px-0.5">{page}</span>
      </div>
    )
  }

  const padded = Math.max(4, Math.ceil(count / 4) * 4)
  const sheets = mode === "mini" ? 1 : padded / 4

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] flex-wrap">
        <span className="text-[0.75rem] text-[var(--text-3)] truncate max-w-[200px]">{fileName}</span>
        <button onClick={() => { setBytes(null); setThumbs([]) }}
          className="text-[0.72rem] text-[var(--text-3)] hover:text-[var(--text)]">{t("pdf.anotherPdf")}</button>

        {/* mode toggle */}
        <div className="flex rounded border border-[var(--border)] overflow-hidden">
          {(["mini", "booklet"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("px-2.5 py-1 text-[0.72rem] transition-colors",
                mode === m ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
              {m === "mini" ? t("zine.modeMini") : t("zine.modeBooklet")}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[0.72rem] text-[var(--text-3)]">{t("zine.paper")}</span>
          <select value={paper} onChange={e => setPaper(e.target.value as Paper)}
            className="rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]">
            <option value="a4">A4</option>
            <option value="a3">A3</option>
          </select>
          <button onClick={download} disabled={busy}
            className="px-4 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity">
            {busy ? "…" : "↓ " + t("zine.download")}
          </button>
        </div>
      </div>
      {status && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-[var(--text-2)]">{status}</p>}
      {mode === "mini" && count > 8 && <p className="shrink-0 px-5 py-1.5 text-[0.75rem] text-amber-500">{t("zine.note8")}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col lg:flex-row gap-8">
        {/* preview */}
        <div className="flex-1 min-w-0">
          {mode === "mini" ? (
            <>
              <p className="label-xs mb-2">{t("zine.sheetPreview")}</p>
              <div className="border border-[var(--border-soft)] rounded-lg p-3 bg-[var(--bg-2)] max-w-2xl">
                <div className="grid grid-cols-4 gap-1">
                  {miniCell(5, true)}{miniCell(4, true)}{miniCell(3, true)}{miniCell(2, true)}
                  {miniCell(6, false)}{miniCell(7, false)}{miniCell(8, false)}{miniCell(1, false)}
                </div>
              </div>
              <p className="mt-2 text-[0.68rem] text-[var(--text-3)]">{t("zine.previewNote")}</p>
            </>
          ) : (
            <>
              <p className="label-xs mb-2">{t("zine.readingOrder")}</p>
              <p className="text-[0.75rem] text-[var(--text-2)] mb-3">
                {count} {t("pdf.pagesCount")} → {padded} {t("pdf.pagesCount")} · {sheets} {t("zine.sheets")}
                {padded > count && <span className="text-[var(--text-3)]"> · {t("zine.blanksNote")}</span>}
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))" }}>
                {Array.from({ length: padded }, (_, i) => {
                  const src = thumbs[i]
                  return (
                    <div key={i} className="relative bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden" style={{ aspectRatio: "1 / 1.414" }}>
                      {src
                        ? <img src={src} alt="" className="max-w-full max-h-full object-contain" />
                        : <span className="text-[var(--text-3)] text-[0.55rem]">{t("zine.blank")}</span>}
                      <span className="absolute bottom-0.5 right-1 text-[0.55rem] text-[var(--text-3)] bg-white/80 rounded px-0.5">{i + 1}</span>
                    </div>
                  )
                })}
              </div>
              {count > THUMB_CAP && <p className="mt-2 text-[0.68rem] text-[var(--text-3)]">…{count - THUMB_CAP}+</p>}
            </>
          )}
        </div>

        {/* instructions */}
        <div className="lg:w-72 shrink-0">
          <p className="label-xs mb-2">{t("zine.howto")}</p>
          <ol className="space-y-2 text-[0.8rem] text-[var(--text-2)] list-decimal list-inside">
            {mode === "mini" ? (
              <>
                <li>{t("zine.step1")}</li>
                <li>{t("zine.step2")}</li>
                <li>{t("zine.step3")}</li>
                <li>{t("zine.step4")}</li>
              </>
            ) : (
              <>
                <li>{t("zine.bStep1")}</li>
                <li>{t("zine.bStep2")}</li>
                <li>{t("zine.bStep3")}</li>
                <li>{t("zine.bStep4")}</li>
              </>
            )}
          </ol>
          <p className="mt-4 text-[0.72rem] text-[var(--text-3)]">{t("zine.tip")}</p>
        </div>
      </div>
    </div>
  )
}
