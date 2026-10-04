// Itens de um objetivo (à vista ou parcelado) e a parte do usuário. Funções puras.
import { addMonths, diffMonths } from './format'
import type { Goal, GoalItem } from './types'

const r2 = (v: number) => Math.round(v * 100) / 100

export interface ItemSummary {
  /** custo total do item: à vista = valor; parcelado = entrada + parcelas */
  total: number
  /** quanto já foi pago (à vista/entrada + parcelas pagas) */
  paid: number
  remaining: number
  /** parte que precisa estar guardada em dinheiro (à vista inteiro ou só a entrada) */
  cashNeeded: number
  cashPaid: number
  installmentsLeft: number
  installmentAmount: number
  /** juros embutidos: custo total menos o preço à vista (nunca negativo) */
  interest: number
  /** mês da última parcela, se parcelado */
  lastMonth: string | null
}

export function summarizeItem(i: GoalItem): ItemSummary {
  if (i.payment === 'cash') {
    return {
      total: i.amount,
      paid: i.paid_amount,
      remaining: Math.max(i.amount - i.paid_amount, 0),
      cashNeeded: i.amount,
      cashPaid: i.paid_amount,
      installmentsLeft: 0,
      installmentAmount: 0,
      interest: 0,
      lastMonth: null,
    }
  }
  const n = i.installments ?? 0
  const parcel = i.installment_amount ?? 0
  const total = r2(i.down_payment + n * parcel)
  const paid = r2(i.paid_amount + i.paid_installments * parcel)
  return {
    total,
    paid,
    remaining: Math.max(r2(total - paid), 0),
    cashNeeded: i.down_payment,
    cashPaid: i.paid_amount,
    installmentsLeft: Math.max(n - i.paid_installments, 0),
    installmentAmount: parcel,
    interest: Math.max(r2(total - i.amount), 0),
    lastMonth: i.first_month && n > 0 ? addMonths(i.first_month, n - 1) : null,
  }
}

/** Parcela ainda não paga que vence em `month` (0 se não há). */
export function installmentDue(i: GoalItem, month: string): number {
  if (i.payment !== 'installments' || !i.first_month || !i.installments || !i.installment_amount) return 0
  const idx = diffMonths(i.first_month, month)
  if (idx < 0 || idx >= i.installments || idx < i.paid_installments) return 0
  return i.installment_amount
}

export interface GoalTotals {
  /** custo de todos os itens (visão do casal) */
  total: number
  paid: number
  remaining: number
  /** a parte do usuário, depois de dividir */
  myTotal: number
  myPaid: number
  myRemaining: number
  /** parcelas que vencem neste mês, parte do usuário */
  myInstallmentsNow: number
  interest: number
}

export function totalsFor(items: GoalItem[], share: number, month: string): GoalTotals {
  let total = 0
  let paid = 0
  let remaining = 0
  let interest = 0
  let now = 0
  for (const i of items) {
    const s = summarizeItem(i)
    total += s.total
    paid += s.paid
    remaining += s.remaining
    interest += s.interest
    now += installmentDue(i, month)
  }
  return {
    total: r2(total),
    paid: r2(paid),
    remaining: r2(remaining),
    myTotal: r2(total * share),
    myPaid: r2(paid * share),
    myRemaining: r2(remaining * share),
    myInstallmentsNow: r2(now * share),
    interest: r2(interest),
  }
}

/**
 * O objetivo "como o planejador enxerga": só a parte do usuário.
 * Com itens, o valor a guardar é a soma das partes à vista/entrada, e o que já foi
 * pago à vista conta como guardado. Sem itens, divide o valor digitado pela parte.
 */
export function effectiveGoal(goal: Goal, items: GoalItem[]): Goal {
  const share = goal.my_share ?? 1
  if (!items.length) {
    return { ...goal, target_amount: r2(goal.target_amount * share), down_payment: r2(goal.down_payment * share) }
  }
  let cash = 0
  let cashPaid = 0
  for (const i of items) {
    const s = summarizeItem(i)
    cash += s.cashNeeded
    cashPaid += s.cashPaid
  }
  return {
    ...goal,
    target_amount: r2(cash * share),
    saved_amount: r2(goal.saved_amount + cashPaid * share),
    financing: false,
    down_payment: 0,
    installments: null,
  }
}
