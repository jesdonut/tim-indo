"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useTheme } from "./ThemeProvider"
import { Icon } from "./Icon"
import { cn } from "@/lib/cn"
import { useT, LANGS, type Lang } from "@/lib/i18n"

// Leopalace and PDF are proper nouns; Builder is translated.
const NAV_ITEMS: { href: string; key?: "nav.builder"; label?: string }[] = [
  { href: "/pdf",       label: "PDF" },
  { href: "/leopalace", label: "Leopalace" },
  { href: "/builder",   key: "nav.builder" },
]

function LanguageMenu() {
  const { lang, setLang, t } = useT()
  const [open, setOpen] = useState(false)
  const current = LANGS.find(l => l.code === lang)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] text-[0.7rem] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all"
        aria-label={t("lang.label")}
      >
        <Icon name="language" size={14} />
        <span className="hidden sm:inline">{current?.label ?? lang}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg overflow-hidden">
          {LANGS.map(l => (
            <button
              key={l.code}
              onMouseDown={() => { setLang(l.code); setOpen(false) }}
              className={cn(
                "w-full text-left px-3 py-2 text-[0.78rem] transition-colors",
                l.code === lang
                  ? "bg-[var(--text)] text-[var(--bg)] font-medium"
                  : "text-[var(--text-2)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { t } = useT()

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
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none mx-4">
          {NAV_ITEMS.map(({ href, key, label }) => {
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
                {key ? t(key) : label}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 flex items-center gap-2">
          <LanguageMenu />
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] text-[0.7rem] font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all"
            aria-label="Toggle theme"
          >
            <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={14} />
            <span className="hidden sm:inline">{theme === "dark" ? t("theme.light") : t("theme.dark")}</span>
          </button>
        </div>

      </div>
    </header>
  )
}
