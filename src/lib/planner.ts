// Cálculos de planejamento. Funções puras, sem dependência de tela ou banco.
import { addMonths, diffMonths } from './format'

export interface PlanInput {
  targetAmount: number
  /** já guardado (valor inicial + aportes registrados) */
  savedAmount: number
  /** mês-alvo ('YYYY-MM-01') */
  targetDate: string
  /** rendimento mensal da reserva, fração (0.008 = 0,8%) */
  yieldPm: number
  financing: boolean
  downPayment: number
  installments: number | null
  /** juros mensais do financiamento, fração */
  interestPm: number
}

/** Parcela de um financiamento pela tabela Price. */
export function pmt(presentValue: number, ratePm: number, n: number): number {
  if (n <= 0 || presentValue <= 0) return 0
  if (ratePm === 0) return presentValue / n
  return (presentValue * ratePm) / (1 - Math.pow(1 + ratePm, -n))
}

/** Quantos meses de aporte faltam (mínimo 1) até o mês-alvo. */
export function monthsLeft(currentMonth: string, targetDate: string): number {
  return Math.max(1, diffMonths(currentMonth, targetDate))
}

/** Aporte mensal para chegar em `target` em `n` meses, com rendimento `r`. */
export function requiredMonthly(target: number, saved: number, n: number, r: number): number {
  if (saved >= target) return 0
  if (r === 0) return (target - saved) / n
  const growth = Math.pow(1 + r, n)
  const need = target - saved * growth
  if (need <= 0) return 0
  return (need * r) / (growth - 1)
}

export interface Financed {
  financedAmount: number
  installment: number
  installments: number
  totalPaid: number
  interestTotal: number
}

export interface Plan {
  months: number
  /** valor a guardar por mês até a data-alvo (a entrada, se financiado) */
  monthly: number
  /** quanto precisa estar guardado na data-alvo */
  goalAtDate: number
  mode: 'cash' | 'financed'
  financed?: Financed
  /** aporte mensal para comprar à vista (só quando há financiamento, para comparar) */
  cashMonthly?: number
}

export function planGoal(input: PlanInput, currentMonth: string): Plan {
  const months = monthsLeft(currentMonth, input.targetDate)
  const useFinancing =
    input.financing && input.installments != null && input.installments > 0 && input.downPayment < input.targetAmount

  if (!useFinancing) {
    return {
      months,
      monthly: requiredMonthly(input.targetAmount, input.savedAmount, months, input.yieldPm),
      goalAtDate: input.targetAmount,
      mode: 'cash',
    }
  }

  const installments = input.installments!
  const financedAmount = input.targetAmount - input.downPayment
  const installment = pmt(financedAmount, input.interestPm, installments)
  const totalPaid = installment * installments
  return {
    months,
    monthly: requiredMonthly(input.downPayment, input.savedAmount, months, input.yieldPm),
    goalAtDate: input.downPayment,
    mode: 'financed',
    cashMonthly: requiredMonthly(input.targetAmount, input.savedAmount, months, input.yieldPm),
    financed: {
      financedAmount,
      installment,
      installments,
      totalPaid,
      interestTotal: totalPaid - financedAmount,
    },
  }
}

export interface ProjectionPoint {
  month: string
  balance: number
}

/** Saldo mês a mês guardando `monthly` até a data-alvo. */
export function projection(input: PlanInput, currentMonth: string, monthly: number): ProjectionPoint[] {
  const n = monthsLeft(currentMonth, input.targetDate)
  const points: ProjectionPoint[] = [{ month: currentMonth, balance: input.savedAmount }]
  let balance = input.savedAmount
  for (let i = 1; i <= n; i++) {
    balance = balance * (1 + input.yieldPm) + monthly
    points.push({ month: addMonths(currentMonth, i), balance })
  }
  return points
}

export interface BudgetImpact {
  /** salário - gastos do mês */
  free: number
  /** soma dos aportes das metas */
  committed: number
  /** o que sobra depois das metas (pode ser negativo) */
  leftover: number
  /** committed / free, ou Infinity se não há folga */
  ratio: number
  fits: boolean
}

export function budgetImpact(salary: number, expenses: number, monthlies: number[]): BudgetImpact {
  const free = salary - expenses
  const committed = monthlies.reduce((s, v) => s + v, 0)
  const leftover = free - committed
  const ratio = committed === 0 ? 0 : free > 0 ? committed / free : Infinity
  return { free, committed, leftover, ratio, fits: leftover >= 0 }
}

export type Severity = 'good' | 'warn' | 'serious' | 'crit'

/** Quanto do salário está comprometido (fração). */
export function severity(ratio: number): { key: Severity; label: string } {
  if (ratio < 0.6) return { key: 'good', label: 'Confortável' }
  if (ratio < 0.8) return { key: 'warn', label: 'Atenção' }
  if (ratio <= 1) return { key: 'serious', label: 'Apertado' }
  return { key: 'crit', label: 'Estourou' }
}
