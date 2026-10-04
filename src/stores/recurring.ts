import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { toNum, type ExpenseKind, type Recurring } from '@/lib/types'
import { useToast } from './toast'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const map = (r: any): Recurring => ({ ...r, amount: toNum(r.amount), due_day: Number(r.due_day) })

export interface RecurringPatch {
  name: string
  category: string
  kind: ExpenseKind
  amount: number
  due_day: number
}

export const useRecurring = defineStore('recurring', () => {
  const toast = useToast()
  const items = ref<Recurring[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('due_day')
      .order('name')
    loading.value = false
    if (error) return toast.error(error)
    items.value = (data ?? []).map(map)
  }

  /** Salva o modelo e propaga para os meses de `fromMonth` em diante. */
  async function update(id: string, patch: RecurringPatch, fromMonth: string) {
    const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
    if (error) return toast.error(error)
    const applied = await supabase.rpc('apply_recurring_change', { p_id: id, p_from: fromMonth })
    if (applied.error) return toast.error(applied.error)
    await load()
    toast.ok('Recorrente atualizada')
  }

  /** Encerra a partir de `fromMonth`: os meses seguintes deixam de existir. */
  async function end(id: string, fromMonth: string) {
    const { error } = await supabase.rpc('end_recurring', { p_id: id, p_from: fromMonth })
    if (error) return toast.error(error)
    await load()
    toast.ok('Recorrente encerrada')
  }

  return { items, loading, load, update, end }
})
