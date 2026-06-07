"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useNotes } from "./useNotes"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"

const AUTH_PATHS = ["/login", "/signup", "/verify"]
const SIDE_KEY   = "notes_side"

export default function FloatingNotes() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<"left" | "right">("right")
  const { content, updateContent, status, isRemote } = useNotes()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Restore side preference
  useEffect(() => {
    const saved = localStorage.getItem(SIDE_KEY)
    if (saved === "left" || saved === "right") setSide(saved)
  }, [])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 60)
  }, [open])

  function toggleSide() {
    const next = side === "right" ? "left" : "right"
    setSide(next)
    localStorage.setItem(SIDE_KEY, next)
  }

  // Hide on auth pages and landing page
  if (pathname === "/" || AUTH_PATHS.some(p => pathname.startsWith(p))) return null

  const statusLabel = {
    idle:   null,
    saving: "saving...",
    saved:  "synced",
    error:  "error saving",
    local:  null,
  }[status]

  return (
    <>
      {/* Trigger tab — visible when panel is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open team notes"
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-[9998]",
            "flex items-center justify-center",
            "w-6 h-14 bg-[var(--surface)] border border-[var(--border)]",
            "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]",
            "transition-colors text-[0.58rem] font-semibold tracking-[0.15em]",
            side === "right"
              ? "right-0 rounded-l border-r-0"
              : "left-0 rounded-r border-l-0"
          )}
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          NOTES
        </button>
      )}

      {/* Floating panel */}
      {open && (
        <div
          className={cn(
            "fixed top-[48px] z-[9999] flex flex-col",
            "w-[280px] h-[calc(100dvh-48px)]",
            "bg-[var(--bg)] shadow-2xl",
            side === "right"
              ? "right-0 border-l border-[var(--border)]"
              : "left-0 border-r border-[var(--border)]"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] shrink-0">
            <span className="text-[0.72rem] font-semibold text-[var(--text)] flex-1 tracking-wide">
              Notes
            </span>

            {/* Sync status */}
            {!isRemote && (
              <span className="text-[0.6rem] text-amber-400" title="Supabase not set up — notes are saved locally only">
                local only
              </span>
            )}
            {isRemote && statusLabel && (
              <span className={cn(
                "text-[0.6rem]",
                status === "error"  ? "text-red-400" :
                status === "saved"  ? "text-[var(--highlight-text)]" :
                "text-[var(--text-3)]"
              )}>
                {statusLabel}
              </span>
            )}

            {/* Side toggle */}
            <button
              onClick={toggleSide}
              title={side === "right" ? "Move to left" : "Move to right"}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors text-sm"
            >
              {side === "right" ? "←" : "→"}
            </button>

            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => updateContent(e.target.value)}
            placeholder={isRemote
              ? "Team notes — synced live with your team."
              : "Notes — saved locally (set up Supabase to sync with team)."}
            className={cn(
              "flex-1 w-full resize-none p-3 bg-transparent",
              "text-[0.82rem] text-[var(--text)] placeholder:text-[var(--text-3)]",
              "outline-none leading-relaxed font-mono"
            )}
            spellCheck={false}
          />
        </div>
      )}
    </>
  )
}
