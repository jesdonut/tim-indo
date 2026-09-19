// Optional password protection for downloaded PDFs. Uses @cantoo/pdf-lib
// (a pdf-lib fork that adds encryption) only for this final step — the rest of
// the app still builds PDFs with plain pdf-lib. Fully client-side; the password
// never leaves the browser.
//
// Note: a standard PDF open-password stops casual viewing, not a determined
// person with the right tools. There is no such thing as an "open once" PDF —
// that needs a server/DRM, not a file setting.

export async function protectPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const pw = password.trim()
  if (!pw) return bytes
  const { PDFDocument } = await import("@cantoo/pdf-lib")
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  await doc.encrypt({ userPassword: pw, ownerPassword: pw })
  return await doc.save()
}
