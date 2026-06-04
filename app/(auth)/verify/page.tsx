import Link from "next/link"

export default function VerifyPage() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">

        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-full border border-[var(--border)] text-2xl">
          ✉︎
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] mb-3">
          Check your email
        </h1>

        <p className="text-sm text-[var(--text-2)] leading-relaxed mb-8">
          We sent a confirmation link to your inbox. Click it to activate your account —
          then you're in.
        </p>

        <div className="border-t border-[var(--border)] pt-6">
          <p className="text-[0.75rem] text-[var(--text-3)]">
            Wrong email?{" "}
            <Link href="/signup" className="text-[var(--text)] underline underline-offset-2 hover:no-underline">
              Start over
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
