import { describe, expect, it } from 'vitest'
import { monthBuckets, type BillEntry } from './card-bill'

const e = (o: Partial<BillEntry> & { amount: number }): BillEntry => ({
  reimbursement: 0, category: 'outros', on_card: false, card_bill: false, ...o,
})

describe('monthBuckets', () => {
  it('sem fatura: "no cartão" é só marcador e o gasto conta normal', () => {
    const b = monthBuckets([e({ amount: 100, on_card: true }), e({ amount: 50 })])
    expect(b.hasBill).toBe(false)
    expect(b.total).toBe(150)
  })

  it('com fatura: itens no cartão ficam dentro e não somam de novo', () => {
    const b = monthBuckets([
      e({ amount: 4650, card_bill: true, category: 'contas' }),
      e({ amount: 129, on_card: true, category: 'saude' }),
      e({ amount: 97, on_card: true, category: 'assinaturas' }),
      e({ amount: 110, category: 'contas' }),
    ])
    expect(b.billEffective).toBe(4650)
    expect(b.insideGross).toBe(226)
    expect(b.undetailed).toBe(4424)
    expect(b.total).toBe(4760) // 4650 da fatura + 110 fora do cartão
    expect(b.byCategory).toEqual({ saude: 129, assinaturas: 97, contas: 4534 }) // 4424 sem detalhe + 110
  })

  it('itens detalhados acima do valor da fatura: vale a soma deles', () => {
    const b = monthBuckets([e({ amount: 100, card_bill: true }), e({ amount: 80, on_card: true }), e({ amount: 70, on_card: true })])
    expect(b.billEffective).toBe(150)
    expect(b.undetailed).toBe(0)
    expect(b.total).toBe(150)
  })

  it('reembolso abate o item dentro da fatura', () => {
    const b = monthBuckets([
      e({ amount: 1000, card_bill: true }),
      e({ amount: 400, on_card: true, reimbursement: 400, category: 'assinaturas' }),
    ])
    expect(b.total).toBe(600) // 600 sem detalhe + 0 da assinatura reembolsada
    expect(b.byCategory.assinaturas).toBeUndefined()
  })

  it('reembolso lançado na fatura abate só a parte sem detalhe', () => {
    const b = monthBuckets([e({ amount: 4650, card_bill: true, reimbursement: 2355 })])
    expect(b.total).toBe(2295)
  })

  it('itens de fora (parcela do objetivo) entram dentro da fatura, já sem a fatia do reembolso', () => {
    const b = monthBuckets(
      [e({ amount: 4650, card_bill: true, category: 'contas' })],
      [{ gross: 2375, reimbursement: 1187.5, category: 'outros' }],
    )
    expect(b.insideGross).toBe(2375)
    expect(b.undetailed).toBe(2275)
    expect(b.total).toBe(3462.5) // 2275 sem detalhe + 1187,50 da parcela depois do reembolso
  })

  it('extras são ignorados quando não há fatura', () => {
    const b = monthBuckets([e({ amount: 10 })], [{ gross: 500, reimbursement: 0, category: 'outros' }])
    expect(b.total).toBe(10)
  })
})
