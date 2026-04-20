import { useState, useCallback } from 'react'

interface ToastData {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

let listeners: Array<(toasts: ToastData[]) => void> = []
let memToasts: ToastData[] = []

function dispatch(toasts: ToastData[]) {
  memToasts = toasts
  listeners.forEach((l) => l(toasts))
}

export function toast({ title, description, variant = 'default' }: Omit<ToastData, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  dispatch([...memToasts, { id, title, description, variant }])
  setTimeout(() => {
    dispatch(memToasts.filter((t) => t.id !== id))
  }, 4000)
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastData[]>(memToasts)
  const subscribe = useCallback((listener: (t: ToastData[]) => void) => {
    listeners.push(listener)
    return () => { listeners = listeners.filter((l) => l !== listener) }
  }, [])
  useState(() => {
    const unsub = subscribe(setToasts)
    return unsub
  })
  return toasts
}
