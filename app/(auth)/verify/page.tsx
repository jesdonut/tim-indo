import Link from "next/link"
import { Icon } from "@/components/Icon"

export default function VerifyPage() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">

        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-full border border-[var(--border)] text-[var(--text-2)]">
          <Icon name="mail" size={28} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] mb-3">
          Check your email
        </h1>

        <p className="text-sm text-[var(--text-2)] leading-relaxed mb-8">
          We sent a magic link to your inbox. Click it and you're in — no password needed.
        </p>

        <div className="border-t border-[var(--border)] pt-6">
          <p className="text-[0.75rem] text-[var(--text-3)]">
            Wrong email?{" "}
            <Link href="/login" className="text-[var(--text)] underline underline-offset-2 hover:no-underline">
              Try again
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
