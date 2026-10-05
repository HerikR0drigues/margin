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
  /** reembolso esperado (nunca passa do custo total) */
  reimbursement: number
  /** custo depois do reembolso */
  netTotal: number
  /** reembolso que abate o valor a guardar agora (só itens à vista) */
  cashReimbursement: number
}

export function summarizeItem(i: GoalItem): ItemSummary {
  if (i.payment === 'cash') {
    const reimb = Math.min(i.reimbursement ?? 0, i.amount)
    return {
      total: i.amount,
      paid: i.paid_amount,
      remaining: Math.max(i.amount - reimb - i.paid_amount, 0),
      cashNeeded: i.amount,
      cashPaid: i.paid_amount,
      installmentsLeft: 0,
      installmentAmount: 0,
      interest: 0,
      lastMonth: null,
      reimbursement: reimb,
      netTotal: i.amount - reimb,
      cashReimbursement: reimb,
    }
  }
  const n = i.installments ?? 0
  const parcel = i.installment_amount ?? 0
  const total = r2(i.down_payment + n * parcel)
  const paid = r2(i.paid_amount + i.paid_installments * parcel)
  const reimb = Math.min(i.reimbursement ?? 0, total)
  return {
    total,
    paid,
    remaining: Math.max(r2(total - reimb - paid), 0),
    cashNeeded: i.down_payment,
    cashPaid: i.paid_amount,
    installmentsLeft: Math.max(n - i.paid_installments, 0),
    installmentAmount: parcel,
    interest: Math.max(r2(total - i.amount), 0),
    lastMonth: i.first_month && n > 0 ? addMonths(i.first_month, n - 1) : null,
    reimbursement: reimb,
    netTotal: r2(total - reimb),
    cashReimbursement: 0,
  }
}

/** Parcela ainda não paga que vence em `month` (0 se não há). */
export function installmentDue(i: GoalItem, month: string): number {
  if (i.payment !== 'installments' || !i.first_month || !i.installments || !i.installment_amount) return 0
  const idx = diffMonths(i.first_month, month)
  if (idx < 0 || idx >= i.installments || idx < i.paid_installments) return 0
  return i.installment_amount
}

/**
 * Quanto a parcela do mês pesa para o usuário: a parte dele da parcela menos a fatia do
 * reembolso que cai junto com cada parcela (reembolso ÷ nº de parcelas). Nunca negativo.
 */
export function installmentNet(i: GoalItem, month: string, share: number): number {
  const due = installmentDue(i, month)
  if (due === 0) return 0
  const perParcel = summarizeItem(i).reimbursement / (i.installments ?? 1)
  return Math.max(r2(due * share - perParcel), 0)
}

/** Parte do valor do objetivo que ainda não virou item. Só informativo: não entra na conta até ser detalhado. */
export function undetailedOf(goalTarget: number, items: GoalItem[]): number {
  const detailed = items.reduce((s, i) => s + i.amount, 0)
  return Math.max(r2(goalTarget - detailed), 0)
}

export interface GoalTotals {
  /** custo de todos os itens (visão do casal) */
  total: number
  /** o que ainda não virou item: aparece como aviso, mas não entra em nenhum cálculo */
  undetailed: number
  paid: number
  remaining: number
  /** reembolsos esperados (já são do usuário, não se dividem) */
  reimbursement: number
  /** a parte do usuário, depois de dividir e abater o reembolso */
  myTotal: number
  myPaid: number
  myRemaining: number
  /** parcelas que vencem neste mês, parte do usuário já sem a fatia do reembolso */
  myInstallmentsNow: number
  interest: number
}

export function totalsFor(
  items: GoalItem[],
  share: number,
  month: string,
  skipInBill = false,
  goalTarget?: number,
): GoalTotals {
  const undetailed = goalTarget != null && items.length ? undetailedOf(goalTarget, items) : 0
  let total = 0
  let paid = 0
  let reimb = 0
  let interest = 0
  let now = 0
  for (const i of items) {
    const s = summarizeItem(i)
    total += s.total
    paid += s.paid
    reimb += s.reimbursement
    interest += s.interest
    // parcela dentro da fatura já pesa pela fatura: não conta de novo
    if (!(skipInBill && i.in_card_bill)) now += installmentNet(i, month, share)
  }
  const myTotal = Math.max(r2(total * share - reimb), 0)
  const myPaid = r2(paid * share)
  return {
    total: r2(total),
    undetailed: r2(undetailed),
    paid: r2(paid),
    remaining: Math.max(r2(total - reimb - paid), 0),
    reimbursement: r2(reimb),
    myTotal,
    myPaid,
    myRemaining: Math.max(r2(myTotal - myPaid), 0),
    myInstallmentsNow: r2(now),
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
  let cashReimb = 0
  for (const i of items) {
    const s = summarizeItem(i)
    cash += s.cashNeeded
    cashPaid += s.cashPaid
    cashReimb += s.cashReimbursement
  }
  return {
    ...goal,
    // o que ainda não virou item não entra na conta; o reembolso é de quem recebe
    // (o usuário) e abate depois de dividir
    target_amount: Math.max(r2(cash * share - cashReimb), 0),
    saved_amount: r2(goal.saved_amount + cashPaid * share),
    financing: false,
    down_payment: 0,
    installments: null,
  }
}
