import { describe, expect, it } from 'vitest'
import { effectiveGoal, installmentDue, installmentNet, myItemCost, summarizeItem, totalsFor, undetailedOf } from './goal-items'
import type { Goal, GoalItem } from './types'

const cash = (o: Partial<GoalItem> = {}): GoalItem => ({
  id: 'c', goal_id: 'g', name: 'Passagens', payment: 'cash', amount: 4000, down_payment: 0,
  installments: null, installment_amount: null, first_month: null, paid_amount: 0, paid_installments: 0, reimbursement: 0, reimbursed: false, in_card_bill: false, ...o,
})
const parc = (o: Partial<GoalItem> = {}): GoalItem => ({
  id: 'p', goal_id: 'g', name: 'Hotel', payment: 'installments', amount: 3000, down_payment: 500,
  installments: 5, installment_amount: 540, first_month: '2026-11-01', paid_amount: 500, paid_installments: 1, reimbursement: 0, reimbursed: false, in_card_bill: false, ...o,
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

describe('reembolso', () => {
  it('abate o custo e o que falta pagar, sem passar do custo', () => {
    const s = summarizeItem(cash({ reimbursement: 3000 }))
    expect(s.netTotal).toBe(1000)
    expect(s.remaining).toBe(1000)
    expect(summarizeItem(cash({ reimbursement: 9000 })).netTotal).toBe(0)
  })
  it('na parte do usuário, o reembolso abate depois de dividir', () => {
    const t = totalsFor([cash({ reimbursement: 1000 })], 0.5, '2026-12-01')
    expect(t.myTotal).toBe(1000) // 4000 × 0,5 − 1000
    expect(t.reimbursement).toBe(1000)
    expect(t.myRemaining).toBe(1000)
  })
  it('reduz o valor a guardar; em itens parcelados só reduz o custo total', () => {
    const e = effectiveGoal(goal({ target_amount: 4000 }), [cash({ reimbursement: 1000 })])
    expect(e.target_amount).toBe(1000) // 4000 × 0,5 − 1000
    const p = effectiveGoal(goal({ target_amount: 3000 }), [parc({ reimbursement: 400 })])
    expect(p.target_amount).toBe(250) // só a entrada: 500 × 0,5
    expect(summarizeItem(parc({ reimbursement: 400 })).remaining).toBe(1760) // 3200 − 400 − 1040
  })
})

describe('dentro da fatura', () => {
  it('parcela dentro da fatura não pesa de novo, quando há fatura no mês', () => {
    const i = parc({ in_card_bill: true })
    expect(totalsFor([i], 0.5, '2026-12-01', true).myInstallmentsNow).toBe(0)
    expect(totalsFor([i], 0.5, '2026-12-01', false).myInstallmentsNow).toBe(270)
  })
})

describe('a detalhar', () => {
  const passagem = () => parc({
    amount: 9500, down_payment: 0, installments: 4, installment_amount: 2375,
    first_month: '2026-10-01', paid_amount: 0, paid_installments: 0,
  })
  it('a diferença entre o valor do objetivo e os itens é só informativa', () => {
    expect(undetailedOf(20000, [passagem()])).toBe(10500)
    expect(undetailedOf(5000, [passagem()])).toBe(0) // itens passam do valor: nada a detalhar
  })
  it('o que não foi detalhado não entra na conta: nem no valor a guardar, nem nos totais', () => {
    // caso real: 20k, metade cada, só a passagem (parcelada, sem entrada) cadastrada
    const e = effectiveGoal(goal({ target_amount: 20000 }), [passagem()])
    expect(e.target_amount).toBe(0) // sem entrada, nada a guardar ainda
    const t = totalsFor([passagem()], 0.5, '2026-10-01', false, 20000)
    expect(t.undetailed).toBe(10500) // aparece como aviso
    expect(t.total).toBe(9500) // mas não soma
    expect(t.myTotal).toBe(4750)
    expect(t.myInstallmentsNow).toBe(1187.5)
  })
  it('sem o valor do objetivo, nada a detalhar', () => {
    expect(totalsFor([passagem()], 0.5, '2026-10-01').undetailed).toBe(0)
  })
})

describe('myItemCost', () => {
  it('é a parte do usuário depois de dividir, menos o reembolso', () => {
    expect(myItemCost(10500, 0, 0.5)).toBe(5250) // item de 10.500 dividido ao meio
    expect(myItemCost(10500, 0, 1)).toBe(10500) // sem divisão, paga tudo
    expect(myItemCost(10500, 1000, 0.5)).toBe(4250)
    expect(myItemCost(1000, 9000, 0.5)).toBe(0) // nunca negativo
  })
})

describe('installmentNet', () => {
  it('o reembolso abate em partes iguais a cada parcela, sem ficar negativo', () => {
    const i = parc({ reimbursement: 400 }) // 400 ÷ 5 parcelas = 80 por parcela
    expect(installmentNet(i, '2026-12-01', 0.5)).toBe(190) // 540 × 0,5 − 80
    expect(installmentNet(i, '2026-12-01', 1)).toBe(460)
    expect(installmentNet(parc({ reimbursement: 3000 }), '2026-12-01', 0.5)).toBe(0)
    expect(installmentNet(i, '2026-10-01', 0.5)).toBe(0) // fora do período
  })
  it('caso real: passagem 9.500 em 4×, metade cada, reembolso de 50%', () => {
    const i = parc({
      amount: 9500, down_payment: 0, installments: 4, installment_amount: 2375,
      first_month: '2026-10-01', paid_amount: 0, paid_installments: 0, reimbursement: 4750,
    })
    expect(installmentNet(i, '2026-10-01', 0.5)).toBe(0) // 1.187,50 − 1.187,50
    expect(totalsFor([i], 0.5, '2026-10-01').myTotal).toBe(0) // 4.750 − 4.750
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
    const e = effectiveGoal(goal({ saved_amount: 100, target_amount: 7000 }), [cash({ paid_amount: 1000 }), parc()])
    expect(e.target_amount).toBe(2250) // (4000 + 500) × 0,5
    expect(e.saved_amount).toBe(850) // 100 + (1000 + 500) × 0,5
    expect(e.financing).toBe(false)
  })
})
