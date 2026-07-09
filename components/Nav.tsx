"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "./ThemeProvider"
import { Icon } from "./Icon"
import { cn } from "@/lib/cn"

const PUBLIC_PATHS = ["/", "/login", "/signup", "/verify", "/join-team"]
const AUTH_PATHS   = ["/login", "/signup", "/verify", "/join-team"]

const NAV_ITEMS = [
  { href: "/people",   label: "People" },
  { href: "/maps",     label: "Maps" },
  { href: "/links",    label: "Moodboard" },
  { href: "/pdf",      label: "PDF" },
  { href: "/translate",label: "Translate" },
  { href: "/builder",  label: "Builder" },
  { href: "/area",      label: "Area" },
  { href: "/extract",   label: "Extract" },
  { href: "/meetings",  label: "定期面談" },
  { href: "/dispatch",  label: "送り込み" },
  { href: "/seo",       label: "SEO" },
]

export default function Nav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, toggle } = useTheme()

  async function handleLogout() {
    const { logOut } = await import("@/app/actions/auth")
    await logOut()
    router.push("/")
  }
  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isAuth = AUTH_PATHS.includes(pathname)

  if (isAuth) return null

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

        {/* Tabs — only shown when logged in (app pages) */}
        {!isPublic && (
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

          {/* Profile + Log out — only on app pages */}
          {!isPublic && (
            <>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all"
                aria-label="Refresh"
              >
                <Icon name="refresh" size={14} />
              </button>
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.7rem] font-medium text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-[0.7rem] font-medium text-[var(--text-3)] hover:text-red-400 hover:border-red-400/50 transition-all"
              >
                Log out
              </button>
            </>
          )}
        </div>

      </div>
    </header>
  )
}
