// Conta do mês com fatura de cartão. Função pura.
//
// Regras:
// - Uma "fatura" (card_bill) é o valor cheio que você paga no cartão.
// - Gastos marcados "no cartão" (on_card) ficam DENTRO da fatura: não somam de novo.
// - Se os itens detalhados passam do valor da fatura, vale a soma deles.
// - O que sobra da fatura sem detalhe entra na categoria da própria fatura.
// - Reembolso abate o custo: de cada item dentro, ou da parte sem detalhe da fatura.
// - Sem nenhuma fatura no mês, "no cartão" é só um marcador e o gasto conta normal.

export interface BillEntry {
  amount: number
  reimbursement: number
  category: string
  on_card: boolean
  card_bill: boolean
}

/** Item que está dentro da fatura mas vem de outro lugar (ex.: parcela de um objetivo). */
export interface ExtraInside {
  gross: number
  reimbursement: number
  category: string
}

export interface MonthBuckets {
  /** custo líquido por categoria (o que conta no mês) */
  byCategory: Record<string, number>
  total: number
  hasBill: boolean
  /** valor lançado na(s) fatura(s) */
  billGross: number
  /** soma do que está detalhado dentro da fatura */
  insideGross: number
  /** valor efetivo da fatura: o maior entre o lançado e o detalhado */
  billEffective: number
  /** parte da fatura sem detalhe */
  undetailed: number
  /** líquido de tudo que está dentro da fatura (itens + parte sem detalhe, já sem reembolso) */
  cardNet: number
}

const r2 = (v: number) => Math.round(v * 100) / 100
const net = (gross: number, reimbursement: number) => Math.max(gross - Math.min(reimbursement, gross), 0)

export function monthBuckets(entries: BillEntry[], extra: ExtraInside[] = []): MonthBuckets {
  const bills = entries.filter((e) => e.card_bill)
  const hasBill = bills.length > 0
  const inside = hasBill ? entries.filter((e) => e.on_card) : []
  const extras = hasBill ? extra : []

  const billGross = bills.reduce((s, e) => s + e.amount, 0)
  const insideGross = inside.reduce((s, e) => s + e.amount, 0) + extras.reduce((s, e) => s + e.gross, 0)
  const billEffective = Math.max(billGross, insideGross)
  const undetailed = Math.max(billGross - insideGross, 0)

  const byCategory: Record<string, number> = {}
  const add = (cat: string, v: number) => {
    if (v > 0) byCategory[cat] = r2((byCategory[cat] ?? 0) + v)
  }

  let cardNet = 0
  for (const e of entries) {
    if (e.card_bill) continue
    if (hasBill && e.on_card) {
      const v = net(e.amount, e.reimbursement)
      add(e.category, v)
      cardNet += v
    } else {
      add(e.category, net(e.amount, e.reimbursement))
    }
  }
  for (const x of extras) {
    const v = net(x.gross, x.reimbursement)
    add(x.category, v)
    cardNet += v
  }
  if (hasBill) {
    // o reembolso lançado na própria fatura abate só a parte sem detalhe
    const billReimb = bills.reduce((s, e) => s + e.reimbursement, 0)
    const rest = Math.max(undetailed - billReimb, 0)
    add(bills[0]!.category, rest)
    cardNet += rest
  }

  const total = r2(Object.values(byCategory).reduce((s, v) => s + v, 0))
  return { byCategory, total, hasBill, billGross: r2(billGross), insideGross: r2(insideGross), billEffective: r2(billEffective), undetailed: r2(undetailed), cardNet: r2(cardNet) }
}
