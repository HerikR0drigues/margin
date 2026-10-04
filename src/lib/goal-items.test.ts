import { describe, expect, it } from 'vitest'
import { effectiveGoal, installmentDue, summarizeItem, totalsFor } from './goal-items'
import type { Goal, GoalItem } from './types'

const cash = (o: Partial<GoalItem> = {}): GoalItem => ({
  id: 'c', goal_id: 'g', name: 'Passagens', payment: 'cash', amount: 4000, down_payment: 0,
  installments: null, installment_amount: null, first_month: null, paid_amount: 0, paid_installments: 0, ...o,
})
const parc = (o: Partial<GoalItem> = {}): GoalItem => ({
  id: 'p', goal_id: 'g', name: 'Hotel', payment: 'installments', amount: 3000, down_payment: 500,
  installments: 5, installment_amount: 540, first_month: '2026-11-01', paid_amount: 500, paid_installments: 1, ...o,
})
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', name: 'Viagem', kind: 'trip', target_amount: 20000, saved_amount: 0, target_date: '2027-06-01',
  yield_pm: 0, financing: false, down_payment: 0, installments: null, interest_pm: 0, my_share: 0.5, archived: false, ...o,
})

describe('summarizeItem', () => {
  it('à vista: custo é o valor e falta o que não foi pago', () => {
    const s = summarizeItem(cash({ paid_amount: 1000 }))
    expect(s).toMatchObject({ total: 4000, paid: 1000, remaining: 3000, cashNeeded: 4000, cashPaid: 1000, interest: 0 })
  })
  it('parcelado: entrada + parcelas, juros e última parcela', () => {
    const s = summarizeItem(parc())
    expect(s.total).toBe(3200) // 500 + 5 × 540
    expect(s.paid).toBe(1040) // entrada 500 + 1 parcela
    expect(s.remaining).toBe(2160)
    expect(s.cashNeeded).toBe(500)
    expect(s.installmentsLeft).toBe(4)
    expect(s.interest).toBe(200)
    expect(s.lastMonth).toBe('2027-03-01')
  })
  it('juros nunca ficam negativos', () => {
    expect(summarizeItem(parc({ amount: 9999 })).interest).toBe(0)
  })
})

describe('installmentDue', () => {
  it('só vence dentro do período e depois das parcelas já pagas', () => {
    const i = parc() // 1ª parcela nov/26, 1 já paga
    expect(installmentDue(i, '2026-10-01')).toBe(0) // antes de começar
    expect(installmentDue(i, '2026-11-01')).toBe(0) // essa é a paga
    expect(installmentDue(i, '2026-12-01')).toBe(540)
    expect(installmentDue(i, '2027-03-01')).toBe(540)
    expect(installmentDue(i, '2027-04-01')).toBe(0) // acabou
  })
  it('à vista não tem parcela', () => {
    expect(installmentDue(cash(), '2026-11-01')).toBe(0)
  })
})

describe('totalsFor', () => {
  it('divide pela parte do usuário', () => {
    const t = totalsFor([cash(), parc()], 0.5, '2026-12-01')
    expect(t.total).toBe(7200)
    expect(t.myTotal).toBe(3600)
    expect(t.myPaid).toBe(520)
    expect(t.myInstallmentsNow).toBe(270)
    expect(t.interest).toBe(200)
  })
})

describe('effectiveGoal', () => {
  it('sem itens: divide o valor digitado pela parte', () => {
    expect(effectiveGoal(goal(), []).target_amount).toBe(10000)
    expect(effectiveGoal(goal({ my_share: 1 }), []).target_amount).toBe(20000)
  })
  it('com itens: guarda só à vista + entrada, e o já pago conta como guardado', () => {
    const e = effectiveGoal(goal({ saved_amount: 100 }), [cash({ paid_amount: 1000 }), parc()])
    expect(e.target_amount).toBe(2250) // (4000 + 500) × 0,5
    expect(e.saved_amount).toBe(850) // 100 + (1000 + 500) × 0,5
    expect(e.financing).toBe(false)
  })
})
