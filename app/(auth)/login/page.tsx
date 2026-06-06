import Link from "next/link"
import AuthForm from "@/components/AuthForm"
import { logIn } from "@/app/actions/auth"

type Props = { searchParams: Promise<{ error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <div className="mb-8 border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">Team Indonesia</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Log in</h1>
        </div>

        {error && (
          <p className="mb-4 text-[0.78rem] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
            {error === "verification_failed" ? "Link expired or invalid — try logging in again." : error}
          </p>
        )}

        <AuthForm
          mode="login"
          action={logIn}
          submitLabel="Log in"
          fields={[
            { name: "email",    label: "Email",    type: "email",    placeholder: "you@example.com" },
            { name: "password", label: "Password", type: "password", placeholder: "••••••••" },
          ]}
          footer={
            <>
              No account?{" "}
              <Link href="/signup" className="text-[var(--text)] underline underline-offset-2 hover:no-underline">
                Sign up
              </Link>
            </>
          }
        />

      </div>
    </div>
  )
}
