export interface Toast {
  id: number
  title: string
  text?: string
  tone: 'win' | 'lose' | 'info' | 'error'
}

let counter = 0

/** Всплывающие уведомления о выигрышах и ошибках. */
export function useToasts() {
  return useState<Toast[]>('toasts', () => [])
}

export function useToast() {
  const toasts = useToasts()

  function push(toast: Omit<Toast, 'id'>, ttl = 5000) {
    const id = ++counter
    toasts.value = [...toasts.value, { ...toast, id }]
    if (import.meta.client) {
      setTimeout(() => dismiss(id), ttl)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    push,
    dismiss,
    win: (title: string, text?: string) => push({ title, text, tone: 'win' }),
    lose: (title: string, text?: string) => push({ title, text, tone: 'lose' }),
    info: (title: string, text?: string) => push({ title, text, tone: 'info' }),
    error: (title: string, text?: string) => push({ title, text, tone: 'error' }),
  }
}
