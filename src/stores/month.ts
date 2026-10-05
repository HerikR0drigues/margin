import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { addMonths, currentMonthKey } from '@/lib/format'
import { toNum, type ExpenseKind, type Income, type MonthEntry } from '@/lib/types'
import { useToast } from './toast'

export interface TrendMonth {
  key: string
  byCategory: Record<string, number>
  total: number
  salary: number
  hasData: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapIncome = (r: any): Income => ({ ...r, amount: toNum(r.amount) })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEntry = (r: any): MonthEntry => ({ ...r, amount: toNum(r.amount), due_day: Number(r.due_day) })

export interface NewExpense {
  name: string
  category: string
  amount: number
  due_day: number
  on_card?: boolean
}

export const useMonth = defineStore('month', () => {
  const toast = useToast()
  const key = ref(currentMonthKey())
  const salary = ref(0)
  const entries = ref<MonthEntry[]>([])
  const incomes = ref<Income[]>([])
  const trend = ref<TrendMonth[]>([])
  const loading = ref(false)
  let requestId = 0

  const visible = computed(() => entries.value.filter((e) => !e.skipped))
  const total = computed(() => visible.value.reduce((s, e) => s + e.amount, 0))
  const paidTotal = computed(() => visible.value.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0))
  const pendingTotal = computed(() => total.value - paidTotal.value)
  const cardTotal = computed(() => visible.value.filter((e) => e.on_card).reduce((s, e) => s + e.amount, 0))
  const cardCount = computed(() => visible.value.filter((e) => e.on_card).length)
  const paidCount = computed(() => visible.value.filter((e) => e.paid).length)
  const estimateCount = computed(() => visible.value.filter((e) => e.is_estimate).length)
  const byCategory = computed(() => {
    const out: Record<string, number> = {}
    for (const e of visible.value) out[e.category] = (out[e.category] ?? 0) + e.amount
    return out
  })
  const extraIncome = computed(() => incomes.value.reduce((s, i) => s + i.amount, 0))
  /** salário + rendas extras do mês */
  const income = computed(() => salary.value + extraIncome.value)
  const free = computed(() => income.value - total.value)
  const previousTotal = computed(() => {
    const prev = trend.value.find((m) => m.key === addMonths(key.value, -1))
    return prev && prev.hasData ? prev.total : null
  })

  async function loadTrend(k: string) {
    const from = addMonths(k, -11)
    const [ents, sets] = await Promise.all([
      supabase.from('month_entries').select('month, category, amount').gte('month', from).lte('month', k).eq('skipped', false),
      supabase.from('month_settings').select('month, salary').gte('month', from).lte('month', k),
    ])
    if (ents.error) throw ents.error
    if (sets.error) throw sets.error
    const months: TrendMonth[] = []
    for (let i = 0; i < 12; i++) {
      months.push({ key: addMonths(from, i), byCategory: {}, total: 0, salary: 0, hasData: false })
    }
    const idx = new Map(months.map((m) => [m.key, m]))
    for (const r of ents.data ?? []) {
      const m = idx.get(r.month as string)
      if (!m) continue
      const amount = toNum(r.amount)
      m.byCategory[r.category as string] = (m.byCategory[r.category as string] ?? 0) + amount
      m.total += amount
      m.hasData = true
    }
    for (const r of sets.data ?? []) {
      const m = idx.get(r.month as string)
      if (!m) continue
      m.salary = toNum(r.salary)
      m.hasData = true
    }
    trend.value = months
  }

  async function load(newKey?: string) {
    if (newKey) key.value = newKey
    const k = key.value
    const id = ++requestId
    loading.value = true
    try {
      const ensured = await supabase.rpc('ensure_month', { p_month: k })
      if (ensured.error) throw ensured.error
      const [ents, set, inc] = await Promise.all([
        supabase.from('month_entries').select('*').eq('month', k).order('due_day').order('name'),
        supabase.from('month_settings').select('salary').eq('month', k).maybeSingle(),
        supabase.from('month_incomes').select('*').eq('month', k).order('created_at'),
      ])
      if (ents.error) throw ents.error
      if (set.error) throw set.error
      if (inc.error) throw inc.error
      await loadTrend(k)
      if (id !== requestId) return
      entries.value = (ents.data ?? []).map(mapEntry)
      salary.value = toNum(set.data?.salary)
      incomes.value = (inc.data ?? []).map(mapIncome)
    } catch (e) {
      if (id === requestId) toast.error(e)
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  async function refreshTrend() {
    try {
      await loadTrend(key.value)
    } catch (e) {
      toast.error(e)
    }
  }

  async function saveSalary(value: number) {
    salary.value = value
    const { error } = await supabase
      .from('month_settings')
      .upsert({ month: key.value, salary: value }, { onConflict: 'user_id,month' })
    if (error) return toast.error(error)
    await refreshTrend()
  }

  async function addIncome(description: string, amount: number) {
    const { data, error } = await supabase
      .from('month_incomes')
      .insert({ month: key.value, description, amount })
      .select()
      .single()
    if (error) return toast.error(error)
    incomes.value.push(mapIncome(data))
    toast.ok('Renda extra adicionada')
  }

  async function removeIncome(id: string) {
    const { error } = await supabase.from('month_incomes').delete().eq('id', id)
    if (error) return toast.error(error)
    incomes.value = incomes.value.filter((i) => i.id !== id)
  }

  async function addOneOff(input: NewExpense) {
    const { data, error } = await supabase
      .from('month_entries')
      .insert({ month: key.value, ...input })
      .select()
      .single()
    if (error) return toast.error(error)
    entries.value.push(mapEntry(data))
    await refreshTrend()
    toast.ok('Gasto avulso adicionado')
  }

  async function addRecurring(input: NewExpense & { kind: ExpenseKind }) {
    const { error } = await supabase.from('recurring_expenses').insert({ ...input, start_month: key.value })
    if (error) return toast.error(error)
    await load()
    toast.ok('Gasto recorrente criado. Ele entra nos próximos meses sozinho.')
  }

  async function updateEntry(entry: MonthEntry, patch: Partial<NewExpense> & { is_estimate?: boolean }) {
    const next = { ...patch }
    if (patch.amount !== undefined && patch.is_estimate === undefined) next.is_estimate = false
    const { error } = await supabase.from('month_entries').update(next).eq('id', entry.id)
    if (error) return toast.error(error)
    Object.assign(entry, next)
    await refreshTrend()
  }

  async function togglePaid(entry: MonthEntry) {
    const paid = !entry.paid
    entry.paid = paid
    const { error } = await supabase.from('month_entries').update({ paid }).eq('id', entry.id)
    if (error) {
      entry.paid = !paid
      toast.error(error)
    }
  }

  /** Recorrente: pula só este mês. Avulso: exclui. */
  async function removeEntry(entry: MonthEntry) {
    if (entry.recurring_id) {
      const { error } = await supabase.from('month_entries').update({ skipped: true }).eq('id', entry.id)
      if (error) return toast.error(error)
      entry.skipped = true
      toast.ok('Pulado neste mês')
    } else {
      const { error } = await supabase.from('month_entries').delete().eq('id', entry.id)
      if (error) return toast.error(error)
      entries.value = entries.value.filter((e) => e.id !== entry.id)
      toast.ok('Gasto removido')
    }
    await refreshTrend()
  }

  async function restoreEntry(entry: MonthEntry) {
    const { error } = await supabase.from('month_entries').update({ skipped: false }).eq('id', entry.id)
    if (error) return toast.error(error)
    entry.skipped = false
    await refreshTrend()
  }

  return {
    key, salary, entries, incomes, trend, loading,
    visible, total, cardTotal, cardCount, paidTotal, pendingTotal, paidCount, estimateCount, byCategory, extraIncome, income, free, previousTotal,
    load, saveSalary, addIncome, removeIncome, addOneOff, addRecurring, updateEntry, togglePaid, removeEntry, restoreEntry,
  }
})
