// Extract {{variable}} names from a template string
export function extractVars(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g)
  const seen = new Set<string>()
  for (const m of matches) seen.add(m[1])
  return [...seen]
}

// Replace {{variable}} in template with values from a row
export function applyTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => row[key] ?? `{{${key}}}`)
}

// Parse pasted Excel/TSV/CSV text into rows of cells
export function parsePaste(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(line => line.trim() !== "")
    .map(line => line.split("\t"))
}
