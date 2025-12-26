import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'

type Toast = {
  id: string
  message: string
  kind: ToastKind
}

const ToastContext = createContext<{
  show: (message: string, kind?: ToastKind) => void
} | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 9)
    setToasts((t) => [...t, { id, message, kind }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) => {
      return setTimeout(() => {
        setToasts((cur) => cur.filter((c) => c.id !== t.id))
      }, 4000)
    })
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container */}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full rounded-md p-3 shadow-md text-sm text-white ${
              t.kind === 'success' ? 'bg-green-600' : t.kind === 'error' ? 'bg-red-600' : 'bg-slate-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx.show
}
