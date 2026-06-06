"use client"

import { useActionState, useEffect, useState } from "react"
import { updateProfile } from "@/app/actions/auth"
import { getTeamData, addTeam } from "@/app/actions/teams"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"

type Member = { id: string; name: string | null; created_at: string }

const INPUT = cn(
  "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
  "text-[var(--text)] text-sm placeholder:text-[var(--text-3)]",
  "outline-none focus:border-[var(--text)] transition-colors"
)

export default function ProfilePage() {
  const [name, setName]         = useState("")
  const [nameJa, setNameJa]     = useState("")
  const [email, setEmail]       = useState("")
  const [userId, setUserId]     = useState("")
  const [teamName, setTeamName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [members, setMembers]   = useState<Member[]>([])
  const [confirmKick, setConfirmKick] = useState<string | null>(null)
  const [showJoin, setShowJoin] = useState(false)
  const [copied, setCopied]     = useState(false)

  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null)
  const [joinState, joinAction, joinPending]           = useActionState(addTeam, null)

  const isLeader = members.length > 0 && members[0].id === userId

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? "")
      setName(user.user_metadata?.name ?? "")
      setNameJa(user.user_metadata?.nameJa ?? "")
      setUserId(user.id)
    })
    getTeamData().then(data => {
      if (!data) return
      if (data.team) {
        setTeamName(data.team.name)
        setInviteCode(data.team.invite_code)
      }
      setMembers(data.profiles)
      setUserId(data.userId)
    })
  }, [])

  useEffect(() => {
    if (joinState && "success" in joinState) {
      setTeamName((joinState as { success: true; teamName: string }).teamName)
      setShowJoin(false)
    }
  }, [joinState])

  function copyInviteCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleKick(targetId: string) {
    if (confirmKick !== targetId) { setConfirmKick(targetId); return }
    const supabase = createClient()
    await supabase.rpc("kick_member", { target_id: targetId })
    setMembers(prev => prev.filter(m => m.id !== targetId))
    setConfirmKick(null)
  }

  const profileSuccess = profileState && typeof profileState === "object" && "success" in profileState
  const profileError   = profileState && typeof profileState === "object" && "error" in profileState
    ? (profileState as { error: string }).error : null
  const joinError      = joinState && typeof joinState === "object" && "error" in joinState
    ? (joinState as { error: string }).error : null

  return (
    <div>
      <PageHeader title="Profile" />
      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">

          {/* ── Left: Account ── */}
          <div className="flex flex-col gap-4">
            <p className="label-xs border-b border-[var(--border)] pb-3">Account</p>

            <form action={profileAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="label-xs" htmlFor="name">Display name</label>
                <input id="name" name="name" type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name" required className={INPUT} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="label-xs" htmlFor="nameJa">Japanese nickname</label>
                <input id="nameJa" name="nameJa" type="text" value={nameJa} onChange={e => setNameJa(e.target.value)}
                  placeholder="e.g. ジェッシカ" className={INPUT} />
                <p className="text-[0.68rem] text-[var(--text-3)]">Used in Area page</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="label-xs">Email</label>
                <p className="text-sm text-[var(--text-2)] px-3 py-2.5 bg-[var(--bg-2)] border border-[var(--border)] rounded opacity-60">
                  {email || "—"}
                </p>
              </div>

              {profileError && (
                <p className="text-[0.78rem] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-[0.78rem] text-green-500 bg-green-400/10 border border-green-400/20 rounded px-3 py-2">Saved!</p>
              )}

              <button type="submit" disabled={profilePending}
                className={cn("w-full py-2.5 rounded font-semibold text-sm transition-all bg-[var(--text)] text-[var(--bg)] hover:opacity-80",
                  profilePending && "opacity-50 cursor-not-allowed")}>
                {profilePending ? "Saving..." : "Save"}
              </button>
            </form>
          </div>

          {/* ── Right: Team ── */}
          <div className="flex flex-col gap-4">
            <p className="label-xs border-b border-[var(--border)] pb-3">Team</p>

            <div className="flex flex-col gap-1.5">
              <label className="label-xs">Team name</label>
              <p className={cn("text-sm text-[var(--text-2)] px-3 py-2.5 bg-[var(--bg-2)] border border-[var(--border)] rounded",
                !teamName && "opacity-40")}>
                {teamName || "No team yet"}
              </p>
            </div>

            {isLeader && inviteCode && (
              <div className="flex flex-col gap-1.5">
                <label className="label-xs">Invite code</label>
                <button type="button" onClick={copyInviteCode}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded border text-sm font-mono transition-all",
                    copied
                      ? "border-[var(--highlight)] bg-[var(--highlight)]/5 text-[var(--highlight-text)]"
                      : "border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-2)] hover:border-[var(--text-2)] hover:text-[var(--text)]"
                  )}>
                  <span>{inviteCode}</span>
                  <span className="text-[0.68rem] font-sans shrink-0 ml-3">
                    {copied ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>
            )}

            {members.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="label-xs">Members</p>
                <div className="flex flex-col gap-1.5">
                  {members.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-2)]">
                      <div className="w-6 h-6 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[0.6rem] font-bold text-[var(--text-2)] shrink-0">
                        {(m.name ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-[var(--text)] flex-1">{m.name ?? "Unnamed"}</span>
                      <div className="flex items-center gap-1.5">
                        {i === 0 && <span className="text-[0.6rem] text-[var(--text-3)]">leader</span>}
                        {m.id === userId && <span className="text-[0.6rem] text-[var(--highlight-text)]">you</span>}
                      </div>
                      {isLeader && m.id !== userId && (
                        confirmKick === m.id ? (
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <span className="text-[0.65rem] text-red-400">Remove?</span>
                            <button onClick={() => handleKick(m.id)} className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[0.65rem] hover:bg-red-600 transition-colors">Yes</button>
                            <button onClick={() => setConfirmKick(null)} className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[0.65rem] text-[var(--text-2)] transition-colors">No</button>
                          </div>
                        ) : (
                          <button onClick={() => handleKick(m.id)} className="text-[0.65rem] text-[var(--text-3)] hover:text-red-400 transition-colors shrink-0">Remove</button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!showJoin ? (
              <button type="button" onClick={() => setShowJoin(true)}
                className="text-left text-[0.78rem] text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                + Join another team
              </button>
            ) : (
              <form action={joinAction} className="flex flex-col gap-3 p-4 border border-[var(--border)] rounded bg-[var(--bg-2)]">
                <p className="label-xs">Join team</p>
                <input name="inviteCode" type="text" placeholder="Enter invite code" required
                  className={cn("w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2",
                    "text-[var(--text)] text-sm placeholder:text-[var(--text-3)] outline-none focus:border-[var(--text)] transition-colors")} />
                {joinError && <p className="text-[0.75rem] text-red-400">{joinError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={joinPending}
                    className={cn("flex-1 py-2 rounded font-semibold text-sm bg-[var(--text)] text-[var(--bg)] hover:opacity-80 transition-all",
                      joinPending && "opacity-50 cursor-not-allowed")}>
                    {joinPending ? "Joining..." : "Join"}
                  </button>
                  <button type="button" onClick={() => setShowJoin(false)}
                    className="px-4 py-2 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </PageContent>
    </div>
  )
}
