export type ColDef = {
  id: string
  label: string
  width: number
  computed?: boolean  // if true, label is treated as a formula using {{col_id}} syntax
}

export type Row = Record<string, string>

export type BuilderState = {
  cols: ColDef[]
  rows: Row[]
  template: string
}
