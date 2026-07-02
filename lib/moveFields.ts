// Field mapping for 送り込みCSV → workers table cross-reference.
// Lives here (not in workerLocations.ts) because "use server" files must only
// export async functions; a plain const export crashes the action bundle.

export const CSV_WORKER_FIELD_MAP = [
  { workerKey: "store_code",          csvKey: "store_code",          currentKey: "current_store_code",          label: "店舗CD",    isDate: false },
  { workerKey: "arrival_group",       csvKey: "ido_group",           currentKey: "current_arrival_group",       label: "入国G",      isDate: false },
  { workerKey: "move_in_date",        csvKey: "move_in_date",        currentKey: "current_move_in_date",        label: "入居日",     isDate: true  },
  { workerKey: "first_work_date",     csvKey: "first_work_date",     currentKey: "current_first_work_date",     label: "初出勤",     isDate: true  },
  { workerKey: "housing_postal_code", csvKey: "housing_postal_code", currentKey: "current_housing_postal_code", label: "郵便番号",   isDate: false },
  { workerKey: "housing_address",     csvKey: "housing_address",     currentKey: "current_housing_address",     label: "住所",       isDate: false },
  { workerKey: "housing_building",    csvKey: "housing_building",    currentKey: "current_housing_building",    label: "物件名",     isDate: false },
  { workerKey: "housing_room",        csvKey: "housing_room",        currentKey: "current_housing_room",        label: "部屋番号",   isDate: false },
  { workerKey: "housing_passcode",    csvKey: "housing_passcode",    currentKey: "current_housing_passcode",    label: "パスコード", isDate: false },
  { workerKey: "leopalace_url",       csvKey: "leopalace_url",       currentKey: "current_leopalace_url",       label: "入居URL",    isDate: false },
  { workerKey: "commute_distance",    csvKey: "commute_distance",    currentKey: "current_commute_distance",    label: "通勤距離",   isDate: false },
  { workerKey: "rent",                csvKey: "rent",                currentKey: "current_rent",                label: "家賃",       isDate: false },
] as const

export type WorkerFieldKey = typeof CSV_WORKER_FIELD_MAP[number]["workerKey"]
