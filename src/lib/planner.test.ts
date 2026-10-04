import { describe, expect, it } from 'vitest'
import { budgetImpact, monthsLeft, planGoal, pmt, projection, requiredMonthly, severity, type PlanInput } from './planner'

const base: PlanInput = {
  targetAmount: 12000,
  savedAmount: 0,
  targetDate: '2027-10-01',
  yieldPm: 0,
  financing: false,
  downPayment: 0,
  installments: null,
  interestPm: 0,
}

describe('pmt', () => {
  it('calcula a parcela pela tabela Price', () => {
    expect(pmt(10000, 0.01, 12)).toBeCloseTo(888.49, 2)
  })
  it('sem juros divide igualmente', () => {
    expect(pmt(1200, 0, 12)).toBe(100)
  })
})

describe('monthsLeft', () => {
  it('conta meses até o mês-alvo', () => {
    expect(monthsLeft('2026-10-01', '2027-10-01')).toBe(12)
  })
  it('nunca é menor que 1', () => {
    expect(monthsLeft('2026-10-01', '2026-10-01')).toBe(1)
    expect(monthsLeft('2026-10-01', '2026-01-01')).toBe(1)
  })
})

describe('requiredMonthly', () => {
  it('sem rendimento é a divisão simples', () => {
    expect(requiredMonthly(12000, 0, 12, 0)).toBe(1000)
    expect(requiredMonthly(12000, 3000, 9, 0)).toBe(1000)
  })
  it('com rendimento o aporte é menor', () => {
    expect(requiredMonthly(12000, 0, 12, 0.01)).toBeLessThan(1000)
  })
  it('é zero se já juntou o suficiente', () => {
    expect(requiredMonthly(5000, 5000, 6, 0.01)).toBe(0)
    expect(requiredMonthly(5000, 4900, 24, 0.02)).toBe(0)
  })
  it('a projeção termina exatamente na meta', () => {
    const input = { ...base, yieldPm: 0.008, savedAmount: 1500 }
    const plan = planGoal(input, '2026-10-01')
    const points = projection(input, '2026-10-01', plan.monthly)
    expect(points.at(-1)!.balance).toBeCloseTo(12000, 2)
    expect(points).toHaveLength(plan.months + 1)
  })
})

describe('planGoal com financiamento', () => {
  const car: PlanInput = {
    ...base,
    targetAmount: 60000,
    downPayment: 12000,
    financing: true,
    installments: 48,
    interestPm: 0.0149,
  }
  it('guarda só a entrada e calcula a parcela', () => {
    const plan = planGoal(car, '2026-10-01')
    expect(plan.mode).toBe('financed')
    expect(plan.monthly).toBe(1000)
    expect(plan.financed!.financedAmount).toBe(48000)
    expect(plan.financed!.installment).toBeCloseTo(pmt(48000, 0.0149, 48), 6)
    expect(plan.financed!.interestTotal).toBeGreaterThan(0)
  })
  it('compara com juntar o valor todo', () => {
    const plan = planGoal(car, '2026-10-01')
    expect(plan.cashMonthly).toBe(5000)
  })
  it('sem parcelas informadas cai no modo à vista', () => {
    const plan = planGoal({ ...car, installments: null }, '2026-10-01')
    expect(plan.mode).toBe('cash')
  })
})

describe('budgetImpact', () => {
  it('desconta as metas da sobra', () => {
    const r = budgetImpact(5500, 3700, [650, 300])
    expect(r.free).toBe(1800)
    expect(r.committed).toBe(950)
    expect(r.leftover).toBe(850)
    expect(r.fits).toBe(true)
  })
  it('avisa quando não cabe', () => {
    const r = budgetImpact(5500, 5000, [650])
    expect(r.fits).toBe(false)
    expect(r.leftover).toBe(-150)
  })
  it('sem folga o comprometimento é infinito', () => {
    expect(budgetImpact(3000, 3000, [100]).ratio).toBe(Infinity)
    expect(budgetImpact(3000, 3000, []).ratio).toBe(0)
  })
})

describe('severity', () => {
  it('classifica pelo comprometimento', () => {
    expect(severity(0.5).key).toBe('good')
    expect(severity(0.7).key).toBe('warn')
    expect(severity(0.95).key).toBe('serious')
    expect(severity(1.2).key).toBe('crit')
  })
})
