"use client"

import { cn } from "@/lib/cn"
import type { ReactNode } from "react"

/**
 * All pages share ONE alignment container: max-w-7xl mx-auto px-5.
 * PageHeader wraps its inner content in that same container so the title's
 * left edge is always pixel-identical to the page content's left edge.
 *
 * The border-b is on the outer full-width div so the separator line goes
 * edge-to-edge, independent of max-width.
 */

const CONTAINER = "max-w-7xl mx-auto px-5 w-full"
const CONTAINER_FULL = "w-full px-5"

export function PageHeader({ title, right, full }: { title: string; right?: ReactNode; full?: boolean }) {
  return (
    <div className="sticky top-[48px] z-30 border-b border-[var(--border)] bg-[var(--bg)] shrink-0">
      <div className={cn(full ? CONTAINER_FULL : CONTAINER, "h-14 flex items-center justify-between gap-4")}>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] shrink-0">{title}</h1>
        {right && <div className="flex items-center gap-2 min-w-0 overflow-x-auto">{right}</div>}
      </div>
    </div>
  )
}

/**
 * PageContent — content area for scrollable pages.
 * Uses the same CONTAINER so the left edge aligns with the header title.
 *
 * `narrow` renders a max-w-sm sub-container but keeps it left-aligned
 * (not re-centered) so the left edge still matches.
 */
export function PageContent({
  children,
  narrow,
  full,
  className,
}: {
  children: ReactNode
  narrow?: boolean
  full?: boolean
  className?: string
}) {
  return (
    <div className={cn(full ? CONTAINER_FULL : CONTAINER, "py-6 pb-10", className)}>
      {narrow ? <div className="max-w-sm">{children}</div> : children}
    </div>
  )
}

/**
 * ToolContent — replaces the flex-1 content region of full-height tool pages.
 * Same CONTAINER so alignment matches the header.
 */
export function ToolContent({
  children,
  full,
  className,
}: {
  children: ReactNode
  full?: boolean
  className?: string
}) {
  return (
    <div className={cn(full ? CONTAINER_FULL : CONTAINER, "flex-1 min-h-0 flex flex-col", className)}>
      {children}
    </div>
  )
}

/**
 * PillTabs — canonical tab switcher used in page headers.
 */
interface TabOption<T extends string> {
  value: T
  label: string
  dot?: boolean
}

export function PillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: TabOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--bg-2)] rounded p-0.5 shrink-0">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 rounded text-[0.72rem] font-medium transition-all whitespace-nowrap",
            value === opt.value
              ? "bg-[var(--text)] text-[var(--bg)]"
              : "text-[var(--text-2)] hover:text-[var(--text)]"
          )}
        >
          {opt.label}
          {opt.dot && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--highlight)] align-middle" />
          )}
        </button>
      ))}
    </div>
  )
}
