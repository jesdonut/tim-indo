"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function TermsContent() {
  const params = useSearchParams()
  const lang = params.get("lang") === "ja" ? "ja" : "en"

  return (
    <div className="min-h-screen px-5 py-12 max-w-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-[0.75rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
          ← Back
        </Link>
        <div className="flex gap-2">
          <Link href="/terms" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "en" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>EN</Link>
          <Link href="/terms?lang=ja" className={`text-[0.65rem] px-2 py-0.5 rounded border transition-colors ${lang === "ja" ? "border-[var(--text)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]"}`}>JA</Link>
        </div>
      </div>

      {lang === "en" ? (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-widest uppercase text-[var(--text-3)] mb-2">Terms & Conditions</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Tim Indo Serba Bisa</h1>
            <p className="text-sm text-[var(--text-3)] mt-1">Last updated: June 2026</p>
          </div>

          <div className="flex flex-col gap-5 text-sm text-[var(--text-2)] leading-relaxed">
            <p className="italic text-[var(--text-3)]">Content coming soon.</p>
          </div>

          <p className="text-[0.7rem] text-[var(--text-3)] border-t border-[var(--border)] pt-4">
            © 2026 Jessica. All rights reserved.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-widest uppercase text-[var(--text-3)] mb-2">利用規約</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Tim Indo Serba Bisa</h1>
            <p className="text-sm text-[var(--text-3)] mt-1">最終更新：2026年6月</p>
          </div>

          <div className="flex flex-col gap-5 text-sm text-[var(--text-2)] leading-relaxed">
            <p className="italic text-[var(--text-3)]">内容は近日公開予定です。</p>
          </div>

          <p className="text-[0.7rem] text-[var(--text-3)] border-t border-[var(--border)] pt-4">
            © 2026 Jessica. All rights reserved.
          </p>
        </div>
      )}
    </div>
  )
}

export default function TermsPage() {
  return (
    <Suspense>
      <TermsContent />
    </Suspense>
  )
}
