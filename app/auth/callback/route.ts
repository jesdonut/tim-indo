import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type       = searchParams.get("type") as "magiclink" | "email" | null
  const next       = searchParams.get("next") ?? "/pdf"

  const supabase = await createClient()

  if (token_hash) {
    const otpType = (type as string) || "magiclink"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: otpType as any })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
