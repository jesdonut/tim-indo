"use client"

import { useActionState } from "react"
import Link from "next/link"
import { cn } from "@/lib/cn"

type Field = {
  name: string
  label: string
  type?: string
  placeholder?: string
  hint?: string
}

type Props = {
  mode: "login" | "signup"
  action: (_: unknown, formData: FormData) => Promise<{ error: string } | void>
  fields: Field[]
  submitLabel: string
  footer: React.ReactNode
}

export default function AuthForm({ mode, action, fields, submitLabel, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const error = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full">
      {fields.map(f => (
        <div key={f.name} className="flex flex-col gap-1.5">
          <label className="label-xs" htmlFor={f.name}>{f.label}</label>
          <input
            id={f.name}
            name={f.name}
            type={f.type ?? "text"}
            placeholder={f.placeholder}
            required
            className={cn(
              "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2.5",
              "text-[var(--text)] text-sm placeholder:text-[var(--text-3)]",
              "outline-none focus:border-[var(--text)] transition-colors duration-150"
            )}
          />
          {f.hint && <p className="text-[0.68rem] text-[var(--text-3)]">{f.hint}</p>}
        </div>
      ))}

      {error && (
        <p className="text-[0.78rem] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "mt-1 w-full py-2.5 rounded font-semibold text-sm transition-all duration-150",
          "bg-[var(--text)] text-[var(--bg)] hover:opacity-80 active:scale-[0.98]",
          pending && "opacity-50 cursor-not-allowed"
        )}
      >
        {pending ? "..." : submitLabel}
      </button>

      <div className="text-center text-[0.75rem] text-[var(--text-3)]">{footer}</div>
    </form>
  )
}
