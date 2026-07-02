import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set — add it to your Vercel environment variables." }, { status: 503 })
  }

  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const audio = fd.get("audio") as File | null
  if (!audio) return NextResponse.json({ error: "No audio file provided" }, { status: 400 })

  const whisperFd = new FormData()
  whisperFd.append("file", audio, audio.name)
  whisperFd.append("model", "whisper-1")
  whisperFd.append("language", "ja")
  whisperFd.append("response_format", "text")

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperFd,
    })
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${e}` }, { status: 502 })
  }

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json({ error: `Whisper API error (${res.status}): ${body}` }, { status: 502 })
  }

  const text = await res.text()
  return NextResponse.json({ text: text.trim() })
}

// Allow up to 30 MB request bodies (WAV chunks can be ~20 MB each)
export const config = { api: { bodyParser: false } }
