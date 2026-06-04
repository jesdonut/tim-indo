import Link from "next/link"
import AuthForm from "@/components/AuthForm"
import { logIn } from "@/app/actions/auth"

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <div className="mb-8 border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">Welcome back</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Log in</h1>
        </div>

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
