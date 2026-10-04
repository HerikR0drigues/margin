import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: number
  title: string
  kind: 'ok' | 'error'
}

export const useToast = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])
  let counter = 0

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }
  function push(title: string, kind: ToastItem['kind'] = 'ok') {
    const id = ++counter
    items.value.push({ id, title, kind })
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
  }
  const ok = (title: string) => push(title, 'ok')
  const error = (e: unknown) => push(errorMessage(e), 'error')

  return { items, push, ok, error, dismiss }
})

export function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Algo deu errado. Tente de novo.'
}
