import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Mascot } from './Mascot'
import type { MascotPose } from './mascot-poses'

interface ToastItem {
  id: number
  message: string
  pose?: MascotPose
  tone: 'default' | 'error'
}

interface ToastContextValue {
  /** Show a friendly toast; pass a mascot pose for celebratory cues. */
  show: (message: string, opts?: { pose?: MascotPose; tone?: 'default' | 'error' }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback<ToastContextValue['show']>((message, opts) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, pose: opts?.pose, tone: opts?.tone ?? 'default' }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 2800)
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
            className={`animate-toast-in flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg ${
              t.tone === 'error' ? 'bg-danger' : 'bg-sand-800'
            }`}
          >
            {t.pose && (
              <span className="animate-wiggle -my-2 inline-block">
                <Mascot pose={t.pose} size={40} />
              </span>
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
