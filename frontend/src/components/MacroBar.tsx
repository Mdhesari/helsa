interface MacroBarProps {
  label: string
  value: number
  /** Null → no target known; bar shows value only. */
  target: number | null
  unit?: string
  /** Any CSS color (design token var or hex). */
  color: string
}

/** Gentle progress bar: value vs target, capped at 100% fill. */
export function MacroBar({ label, value, target, unit = 'g', color }: MacroBarProps) {
  const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target !== null && target > 0 && value > target

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-bold text-sand-700">{label}</span>
        <span className="font-semibold text-sand-500 tabular-nums">
          {Math.round(value)}
          {target !== null && (
            <span className="text-sand-400"> / {Math.round(target)}</span>
          )}{' '}
          {unit}
          {over && (
            <span className="ml-1 font-bold text-flame" title="Over target">
              over
            </span>
          )}
        </span>
      </div>
      <div
        className="h-3.5 overflow-hidden rounded-full bg-sand-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target !== null ? Math.round(target) : undefined}
      >
        {target !== null && (
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        )}
      </div>
    </div>
  )
}
