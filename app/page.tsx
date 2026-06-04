import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex flex-col px-5 py-12 max-w-5xl mx-auto w-full">

      <p className="label-xs">Internal tools · Team Indonesia</p>

      <div className="flex-1 flex flex-col justify-center gap-10 py-12">

        <div className="border-l-2 border-[var(--highlight)] pl-5">
          <h1 className="display text-[var(--text)]">
            Tim Indo<br />
            <span className="text-[var(--text-3)]">Serba Bisa</span>
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-16 border-t border-[var(--border)] pt-8">
          <p className="text-sm text-[var(--text-2)] max-w-xs leading-relaxed">
            One place for all the tools the team uses every day.
            PDF, translation, postal lookup, area management, and more.
          </p>

          <div className="flex items-center gap-3 sm:ml-auto shrink-0">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded border border-[var(--border)] text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all duration-150"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold hover:opacity-80 transition-opacity duration-150"
            >
              Sign up
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {["PDF", "Translate", "Postal", "Spell", "Compress", "Station", "Builder", "Docs", "Area", "Phone"].map(t => (
            <span key={t} className="label-xs">{t}</span>
          ))}
        </div>

      </div>

      <div className="border-t border-[var(--border)] pt-5 flex items-center justify-between">
        <span className="label-xs">v2 · 2026</span>
        <span className="label-xs">Team only · invite required</span>
      </div>

    </div>
  )
}
