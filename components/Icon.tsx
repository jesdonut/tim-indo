export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-icons-outlined select-none${className ? ` ${className}` : ""}`}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
