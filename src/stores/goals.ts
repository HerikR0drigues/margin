import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { toNum, type Contribution, type Goal, type GoalItem } from '@/lib/types'
import { effectiveGoal, totalsFor } from '@/lib/goal-items'
import { currentMonthKey } from '@/lib/format'
import type { GoalKind } from '@/lib/categories'
import { useToast } from './toast'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapGoal = (r: any): Goal => ({
  ...r,
  target_amount: toNum(r.target_amount),
  saved_amount: toNum(r.saved_amount),
  yield_pm: toNum(r.yield_pm),
  down_payment: toNum(r.down_payment),
  interest_pm: toNum(r.interest_pm),
  my_share: r.my_share == null ? 1 : toNum(r.my_share),
  installments: r.installments == null ? null : Number(r.installments),
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapItem = (r: any): GoalItem => ({
  ...r,
  amount: toNum(r.amount),
  down_payment: toNum(r.down_payment),
  paid_amount: toNum(r.paid_amount),
  installments: r.installments == null ? null : Number(r.installments),
  installment_amount: r.installment_amount == null ? null : toNum(r.installment_amount),
  paid_installments: Number(r.paid_installments ?? 0),
  reimbursement: toNum(r.reimbursement ?? 0),
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapContribution = (r: any): Contribution => ({ ...r, amount: toNum(r.amount) })

export interface GoalInput {
  name: string
  kind: GoalKind
  target_amount: number
  saved_amount: number
  target_date: string
  yield_pm: number
  financing: boolean
  down_payment: number
  installments: number | null
  interest_pm: number
  my_share: number
}

export type GoalItemInput = Omit<GoalItem, 'id' | 'goal_id'>

export const useGoals = defineStore('goals', () => {
  const toast = useToast()
  const goals = ref<Goal[]>([])
  const contributions = ref<Contribution[]>([])
  const items = ref<GoalItem[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const [g, c, it] = await Promise.all([
      supabase.from('goals').select('*').eq('archived', false).order('target_date'),
      supabase.from('goal_contributions').select('*'),
      supabase.from('goal_items').select('*').order('created_at'),
    ])
    loading.value = false
    if (g.error) return toast.error(g.error)
    if (c.error) return toast.error(c.error)
    if (it.error) return toast.error(it.error)
    goals.value = (g.data ?? []).map(mapGoal)
    contributions.value = (c.data ?? []).map(mapContribution)
    items.value = (it.data ?? []).map(mapItem)
  }

  const itemsOf = (goalId: string) => items.value.filter((i) => i.goal_id === goalId)
  /** O objetivo como o planejador enxerga: só a parte do usuário. */
  const effective = (g: Goal) => effectiveGoal(g, itemsOf(g.id))
  const totals = (g: Goal, month = currentMonthKey()) => totalsFor(itemsOf(g.id), g.my_share, month)

  /** Valor inicial (já com o que foi pago à vista nos itens) + aportes registrados. */
  function savedFor(goal: Goal) {
    return (
      effective(goal).saved_amount +
      contributions.value.filter((c) => c.goal_id === goal.id).reduce((s, c) => s + c.amount, 0)
    )
  }
  function contributionFor(goalId: string, month: string) {
    return contributions.value.find((c) => c.goal_id === goalId && c.month === month) ?? null
  }

  async function create(input: GoalInput) {
    const { error } = await supabase.from('goals').insert(input)
    if (error) return toast.error(error)
    await load()
    toast.ok('Objetivo criado')
  }

  async function update(id: string, input: Partial<GoalInput>) {
    const { error } = await supabase.from('goals').update(input).eq('id', id)
    if (error) return toast.error(error)
    await load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) return toast.error(error)
    goals.value = goals.value.filter((g) => g.id !== id)
    toast.ok('Objetivo removido')
  }

  async function addItem(goalId: string, input: GoalItemInput) {
    const { error } = await supabase.from('goal_items').insert({ goal_id: goalId, ...input })
    if (error) return toast.error(error)
    await load()
    toast.ok('Item adicionado')
  }

  async function updateItem(id: string, input: GoalItemInput) {
    const { error } = await supabase.from('goal_items').update(input).eq('id', id)
    if (error) return toast.error(error)
    await load()
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('goal_items').delete().eq('id', id)
    if (error) return toast.error(error)
    items.value = items.value.filter((i) => i.id !== id)
    toast.ok('Item removido')
  }

  async function contribute(goalId: string, month: string, amount: number) {
    const { error } = await supabase
      .from('goal_contributions')
      .upsert({ goal_id: goalId, month, amount }, { onConflict: 'goal_id,month' })
    if (error) return toast.error(error)
    await load()
    toast.ok('Aporte registrado')
  }

  async function removeContribution(id: string) {
    const { error } = await supabase.from('goal_contributions').delete().eq('id', id)
    if (error) return toast.error(error)
    await load()
  }

  return { goals, contributions, items, loading, load, itemsOf, effective, totals, addItem, updateItem, removeItem, savedFor, contributionFor, create, update, remove, contribute, removeContribution }
})
