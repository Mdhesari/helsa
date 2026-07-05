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

import type { MascotPose } from './mascot-poses'

interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'error'
}

interface ToastContextValue {
  /**
   * Show a minimal toast. `pose` is accepted for compatibility with
   * celebratory call sites, but the redesigned toast keeps a quiet look.
   */
  show: (message: string, opts?: { pose?: MascotPose; tone?: 'default' | 'error' }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback<ToastContextValue['show']>((message, opts) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, tone: opts?.tone ?? 'default' }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 2600)
  }, [])

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
            className={`animate-toast-in flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
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
