import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { toNum, type Contribution, type Goal } from '@/lib/types'
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
  installments: r.installments == null ? null : Number(r.installments),
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
}

export const useGoals = defineStore('goals', () => {
  const toast = useToast()
  const goals = ref<Goal[]>([])
  const contributions = ref<Contribution[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const [g, c] = await Promise.all([
      supabase.from('goals').select('*').eq('archived', false).order('target_date'),
      supabase.from('goal_contributions').select('*'),
    ])
    loading.value = false
    if (g.error) return toast.error(g.error)
    if (c.error) return toast.error(c.error)
    goals.value = (g.data ?? []).map(mapGoal)
    contributions.value = (c.data ?? []).map(mapContribution)
  }

  /** Valor inicial + aportes registrados. */
  function savedFor(goal: Goal) {
    return (
      goal.saved_amount +
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

  return { goals, contributions, loading, load, savedFor, contributionFor, create, update, remove, contribute, removeContribution }
})
