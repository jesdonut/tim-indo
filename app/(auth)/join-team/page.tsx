import AuthForm from "@/components/AuthForm"
import { joinTeam } from "@/app/actions/teams"

export default function JoinTeamPage() {
  return (
    <div className="min-h-[calc(100dvh-48px)] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">

        <div className="mb-8 border-b border-[var(--border)] pb-6">
          <p className="label-xs mb-2">One more step</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Join your team</h1>
          <p className="text-sm text-[var(--text-3)] mt-2">Enter your invite code to connect to your team's data.</p>
        </div>

        <AuthForm
          mode="join-team"
          action={joinTeam}
          submitLabel="Join team"
          fields={[
            { name: "inviteCode", label: "Invite code", type: "text", placeholder: "Ask Jessica for the code" },
          ]}
        />

      </div>
    </div>
  )
}
