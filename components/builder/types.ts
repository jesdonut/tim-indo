export type ColDef = {
  id: string
  label: string
  width: number
}

export type Row = Record<string, string>

export type BuilderState = {
  cols: ColDef[]
  rows: Row[]
  template: string
}
