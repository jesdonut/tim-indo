"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "./ThemeProvider"
import { Icon } from "./Icon"
import { cn } from "@/lib/cn"

const NAV_ITEMS = [
  { href: "/leopalace", label: "Leopalace" },
  { href: "/pdf",       label: "PDF" },
  { href: "/builder",   label: "Builder" },
]

export default function Nav() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 h-12">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <span className="text-[0.65rem] font-bold tracking-[0.15em] uppercase text-[var(--text)] group-hover:text-[var(--text-2)] transition-colors">
            Tim Indo
          </span>
          <span className="hidden sm:block text-[0.55rem] tracking-[0.08em] uppercase text-[var(--text-3)]">
            Serba Bisa
          </span>
        </Link>

        {/* Tabs */}
        {(
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none mx-4">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded text-[0.75rem] font-medium transition-all duration-150 whitespace-nowrap",
                    active
                      ? "bg-[var(--text)] text-[var(--bg)]"
                      : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]"
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        )}

        <div className="shrink-0 flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] text-[0.7rem] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all"
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={14} />
            <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>

      </div>
    </header>
  )
}
