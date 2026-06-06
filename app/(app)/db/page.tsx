export default function DBPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100dvh-48px)] gap-3 text-center px-6">
      <p className="text-2xl font-bold text-[var(--text)]">Database</p>
      <p className="text-sm text-[var(--text-3)] max-w-xs leading-relaxed">
        Connect Supabase first — add your project URL and anon key to <code className="text-[var(--highlight-text)] font-mono text-xs">.env.local</code>, then come back here to manage team data.
      </p>
    </div>
  )
}
