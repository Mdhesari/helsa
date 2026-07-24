import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, Check } from 'lucide-react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'error'
  action?: ToastAction
}

interface ToastOptions {
  tone?: 'default' | 'error'
  /** Optional inline action (e.g. Undo). Dismisses the toast when tapped. */
  action?: ToastAction
  /** Auto-dismiss delay; defaults to 2600ms (4s when an action is present). */
  durationMs?: number
}

interface ToastContextValue {
  show: (message: string, opts?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback<ToastContextValue['show']>(
    (message, opts) => {
      const id = nextId.current++
      setToasts((t) => [
        ...t,
        { id, message, tone: opts?.tone ?? 'default', action: opts?.action },
      ])
      const delay = opts?.durationMs ?? (opts?.action ? 4000 : 2600)
      window.setTimeout(() => dismiss(id), delay)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto flex max-w-md items-center gap-2 rounded-full py-2 pl-4 text-sm font-medium shadow-lg ${
              t.action ? 'pr-2' : 'pr-4'
            } ${
              t.tone === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-foreground text-background'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <Check aria-hidden="true" className="size-4 shrink-0" />
            )}
            {t.message}
            {t.action && (
              <button
                type="button"
                className="ml-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
