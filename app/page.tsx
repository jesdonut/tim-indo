import Link from "next/link"

const TOOLS = [
  { href: "/pdf",       label: "PDF",       desc: "Merge, rotate & download" },
  { href: "/translate", label: "Translate",  desc: "Japanese ↔ Indonesian" },
  { href: "/postal",    label: "Postal",     desc: "Japan postcode lookup" },
  { href: "/spell",     label: "Spell",      desc: "Spell checker" },
  { href: "/compress",  label: "Compress",   desc: "Image compression" },
  { href: "/station",   label: "Station",    desc: "Nearest station finder" },
  { href: "/builder",   label: "Builder",    desc: "Document builder" },
  { href: "/docs",      label: "Docs",       desc: "ID & document templates" },
  { href: "/area",      label: "Area",       desc: "Prefecture map & assignments" },
  { href: "/phone",     label: "Phone",      desc: "Utility call scripts" },
]

export default function Home() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex flex-col px-5 py-10 max-w-5xl mx-auto w-full">

      {/* Hero */}
      <div className="border-b border-[var(--border)] pb-10 mb-10">
        <p className="label-xs mb-4">Internal tools — Tim Indo Serba Bisa</p>
        <h1 className="display text-[var(--text)]">
          Every tool<br />
          <span className="text-[var(--text-3)]">in one place.</span>
        </h1>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-[var(--border)]">
        {TOOLS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col justify-between bg-[var(--bg)] p-4 min-h-[110px] hover:bg-[var(--bg-2)] transition-colors duration-150"
          >
            <span className="text-[0.7rem] font-semibold tracking-[0.08em] uppercase text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors">
              {label}
            </span>
            <span className="text-[0.82rem] text-[var(--text-2)] leading-snug mt-2">
              {desc}
            </span>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-10 border-t border-[var(--border)] flex items-center justify-between">
        <span className="label-xs">v2</span>
        <span className="label-xs">Tim Indo © 2026</span>
      </div>

    </div>
  )
}
