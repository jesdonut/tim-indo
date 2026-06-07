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

        <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-col gap-3">
          <p className="text-[0.68rem] text-[var(--text-3)] leading-relaxed">
            By using this application, you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--text)] transition-colors">Terms of Use</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--text)] transition-colors">Privacy Policy</Link>.
            This application is an independent personal project provided for authorized team use and is not an official company system.
          </p>
          <p className="text-[0.68rem] text-[var(--text-3)] leading-relaxed">
            このアプリケーションを使用することで、
            <Link href="/terms?lang=ja" className="underline underline-offset-2 hover:text-[var(--text)] transition-colors">利用規約</Link>
            および
            <Link href="/privacy?lang=ja" className="underline underline-offset-2 hover:text-[var(--text)] transition-colors">プライバシーポリシー</Link>
            に同意したものとみなされます。本アプリケーションは、認可されたチーム利用のために提供される独立した個人プロジェクトであり、会社の公式システムではありません。
          </p>
        </div>

      </div>
    </div>
  )
}
