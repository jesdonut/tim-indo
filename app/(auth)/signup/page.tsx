import Link from "next/link"
import AuthForm from "@/components/AuthForm"
import { signUp } from "@/app/actions/auth"

export default function SignupPage() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <div className="mb-8 border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">Team Indonesia</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Create account</h1>
        </div>

        <AuthForm
          mode="signup"
          action={signUp}
          submitLabel="Create account"
          fields={[
            { name: "name",       label: "Name",        type: "text",     placeholder: "Your name" },
            { name: "email",      label: "Email",       type: "email",    placeholder: "you@example.com" },
            { name: "password",   label: "Password",    type: "password", placeholder: "Min. 8 characters" },
            {
              name: "inviteCode",
              label: "Invite code",
              type: "text",
              placeholder: "Ask Jessica for the code",
              hint: "This tool is for the team only. You need an invite code to sign up.",
            },
          ]}
          footer={
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--text)] underline underline-offset-2 hover:no-underline">
                Log in
              </Link>
            </>
          }
        />

      </div>
    </div>
  )
}
