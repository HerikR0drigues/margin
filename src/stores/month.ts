import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { addMonths, currentMonthKey, diffMonths } from '@/lib/format'
import { monthBuckets, type BillEntry } from '@/lib/card-bill'
import { installmentDue, summarizeItem } from '@/lib/goal-items'
import { toNum, type ExpenseKind, type Income, type MonthEntry } from '@/lib/types'
import { useGoals } from './goals'
import { useToast } from './toast'

/** Item que aparece dentro da fatura: um gasto marcado "no cartão" ou a parcela de um objetivo. */
export interface InsideRow {
  id: string
  name: string
  sub: string
  category: string
  gross: number
  reimbursement: number
  /** parte da outra pessoa (objetivo dividido) dentro de uma parcela que você pagou no cartão */
  other: number
  reimbursed: boolean
  entry: MonthEntry | null
}

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
const mapEntry = (r: any): MonthEntry => ({
  ...r,
  amount: toNum(r.amount),
  due_day: Number(r.due_day),
  reimbursement: toNum(r.reimbursement ?? 0),
})

/** Custo real do gasto: valor menos o reembolso (nunca negativo). */
export const netOf = (e: { amount: number; reimbursement: number }) => Math.max(e.amount - e.reimbursement, 0)
/** Reembolso que de fato abate (não passa do valor). */
const reimbOf = (e: { amount: number; reimbursement: number }) => Math.min(e.reimbursement, e.amount)

export interface NewExpense {
  name: string
  category: string
  amount: number
  due_day: number
  on_card?: boolean
  card_bill?: boolean
  reimbursement?: number
}

export const useMonth = defineStore('month', () => {
  const toast = useToast()
  const goals = useGoals()
  const key = ref(currentMonthKey())
  const salary = ref(0)
  /** quanto da sobra vai para investimentos neste mês (não é gasto) */
  const invest = ref(0)
  const investDone = ref(false)
  const entries = ref<MonthEntry[]>([])
  const incomes = ref<Income[]>([])
  const trend = ref<TrendMonth[]>([])
  const loading = ref(false)
  let requestId = 0

  const visible = computed(() => entries.value.filter((e) => !e.skipped))
  const bills = computed(() => visible.value.filter((e) => e.card_bill))
  const hasBill = computed(() => bills.value.length > 0)

  /** Parcelas de objetivos que estão dentro da fatura deste mês. */
  const goalInside = computed<InsideRow[]>(() => {
    if (!hasBill.value) return []
    const rows: InsideRow[] = []
    for (const i of goals.items) {
      if (!i.in_card_bill || !i.first_month || !i.installments || !i.installment_amount) continue
      if (installmentDue(i, key.value) === 0) continue
      const idx = diffMonths(i.first_month, key.value)
      const share = goals.goals.find((g) => g.id === i.goal_id)?.my_share ?? 1
      rows.push({
        id: 'goal-' + i.id,
        name: i.name,
        sub: `parcela ${idx + 1}/${i.installments} · Planejamento`,
        category: 'outros',
        gross: i.installment_amount,
        // o reembolso do item cai em partes iguais, junto com cada parcela
        reimbursement: Math.min(summarizeItem(i).reimbursement / i.installments, i.installment_amount),
        // a metade da outra pessoa está na sua fatura, mas não é custo seu
        other: Math.round(i.installment_amount * (1 - share) * 100) / 100,
        reimbursed: i.reimbursed,
        entry: null,
      })
    }
    return rows
  })

  /** Gastos marcados "no cartão" (só ficam dentro da fatura quando há fatura no mês). */
  const insideEntries = computed(() => (hasBill.value ? visible.value.filter((e) => e.on_card) : []))
  const insideRows = computed<InsideRow[]>(() => [
    ...insideEntries.value.map((e) => ({
      id: e.id, name: e.name, sub: '', category: e.category, gross: e.amount,
      reimbursement: reimbOf(e), other: 0, reimbursed: e.reimbursed, entry: e,
    })),
    ...goalInside.value,
  ])
  /** O que aparece solto na lista: tudo, menos o que está dentro da fatura. */
  const topEntries = computed(() => visible.value.filter((e) => !(hasBill.value && e.on_card)))

  const buckets = computed(() =>
    monthBuckets(
      visible.value as BillEntry[],
      goalInside.value.map((r) => ({ gross: r.gross, reimbursement: r.reimbursement + r.other, category: r.category })),
    ),
  )
  /** custo líquido do mês: fatura contada uma vez só e já abatidos os reembolsos */
  const total = computed(() => buckets.value.total)
  const byCategory = computed(() => buckets.value.byCategory)
  /** valor cheio da fatura (ou, sem fatura, o que está marcado no cartão) */
  const cardTotal = computed(() =>
    hasBill.value ? buckets.value.billEffective : visible.value.filter((e) => e.on_card).reduce((s, e) => s + e.amount, 0),
  )
  const cardCount = computed(() => (hasBill.value ? insideRows.value.length : visible.value.filter((e) => e.on_card).length))
  const insideGross = computed(() => buckets.value.insideGross)
  const undetailed = computed(() => buckets.value.undetailed)

  const paidTotal = computed(() => {
    const billsPaid = hasBill.value && bills.value.every((b) => b.paid)
    const loose = topEntries.value.filter((e) => !e.card_bill && e.paid).reduce((s, e) => s + netOf(e), 0)
    return loose + (billsPaid ? buckets.value.cardNet : 0)
  })
  const pendingTotal = computed(() => total.value - paidTotal.value)
  /** reembolsos ainda não recebidos e já recebidos neste mês */
  const reimbPending = computed(
    () =>
      visible.value.filter((e) => !e.reimbursed).reduce((s, e) => s + reimbOf(e), 0) +
      goalInside.value.filter((r) => !r.reimbursed).reduce((s, r) => s + r.reimbursement, 0),
  )
  const reimbReceived = computed(
    () =>
      visible.value.filter((e) => e.reimbursed).reduce((s, e) => s + reimbOf(e), 0) +
      goalInside.value.filter((r) => r.reimbursed).reduce((s, r) => s + r.reimbursement, 0),
  )
  const paidCount = computed(() => topEntries.value.filter((e) => e.paid).length)
  const estimateCount = computed(() => visible.value.filter((e) => e.is_estimate).length)
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
      supabase.from('month_entries').select('month, category, amount, reimbursement, on_card, card_bill').gte('month', from).lte('month', k).eq('skipped', false),
      supabase.from('month_settings').select('month, salary').gte('month', from).lte('month', k),
    ])
    if (ents.error) throw ents.error
    if (sets.error) throw sets.error
    const months: TrendMonth[] = []
    for (let i = 0; i < 12; i++) {
      months.push({ key: addMonths(from, i), byCategory: {}, total: 0, salary: 0, hasData: false })
    }
    const idx = new Map(months.map((m) => [m.key, m]))
    const perMonth = new Map<string, BillEntry[]>()
    for (const r of ents.data ?? []) {
      const list = perMonth.get(r.month as string) ?? []
      list.push({
        amount: toNum(r.amount),
        reimbursement: toNum(r.reimbursement ?? 0),
        category: r.category as string,
        on_card: !!r.on_card,
        card_bill: !!r.card_bill,
      })
      perMonth.set(r.month as string, list)
    }
    for (const [k, list] of perMonth) {
      const m = idx.get(k)
      if (!m) continue
      const b = monthBuckets(list)
      m.byCategory = b.byCategory
      m.total = b.total
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
        supabase.from('month_settings').select('salary, invest, invest_done').eq('month', k).maybeSingle(),
        supabase.from('month_incomes').select('*').eq('month', k).order('created_at'),
      ])
      if (ents.error) throw ents.error
      if (set.error) throw set.error
      if (inc.error) throw inc.error
      await loadTrend(k)
      if (id !== requestId) return
      entries.value = (ents.data ?? []).map(mapEntry)
      salary.value = toNum(set.data?.salary)
      invest.value = toNum(set.data?.invest ?? 0) || 0
      investDone.value = !!set.data?.invest_done
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

  async function saveInvest(value: number) {
    invest.value = value
    const { error } = await supabase
      .from('month_settings')
      .upsert({ month: key.value, invest: value }, { onConflict: 'user_id,month' })
    if (error) toast.error(error)
  }

  async function toggleInvestDone() {
    const done = !investDone.value
    investDone.value = done
    const { error } = await supabase
      .from('month_settings')
      .upsert({ month: key.value, invest_done: done }, { onConflict: 'user_id,month' })
    if (error) {
      investDone.value = !done
      toast.error(error)
    }
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
  /** Marca o reembolso deste gasto como recebido (ou volta para pendente). */
  async function toggleReimbursed(entry: MonthEntry) {
    const reimbursed = !entry.reimbursed
    entry.reimbursed = reimbursed
    const { error } = await supabase.from('month_entries').update({ reimbursed }).eq('id', entry.id)
    if (error) {
      entry.reimbursed = !reimbursed
      toast.error(error)
    }
  }

  async function removeEntry(entry: MonthEntry) {
    if (entry.recurring_id) {
      const { error } = await supabase.from('month_entries').update({ skipped: true }).eq('id', entry.id)
      if (error) return toast.error(error)
      entry.skipped = true
      toast.ok('Pulado neste mês. Para voltar, use "Restaurar" no fim da lista.')
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
    key, salary, invest, investDone, entries, incomes, trend, loading,
    visible, bills, hasBill, topEntries, insideRows, insideGross, undetailed, total, reimbPending, reimbReceived, cardTotal, cardCount, paidTotal, pendingTotal, paidCount, estimateCount, byCategory, extraIncome, income, free, previousTotal,
    load, saveSalary, saveInvest, toggleInvestDone, addIncome, removeIncome, addOneOff, addRecurring, toggleReimbursed, updateEntry, togglePaid, removeEntry, restoreEntry,
  }
})
