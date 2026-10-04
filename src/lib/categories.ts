// Cada categoria tem sempre a mesma cor (slot fixo da paleta de gráficos).
export const CATEGORIES = [
  { id: 'moradia', name: 'Moradia', color: 'var(--chart-1)' },
  { id: 'contas', name: 'Contas', color: 'var(--chart-2)' },
  { id: 'cartao', name: 'Cartão', color: 'var(--chart-3)' },
  { id: 'assinaturas', name: 'Assinaturas', color: 'var(--chart-4)' },
  { id: 'saude', name: 'Saúde', color: 'var(--chart-5)' },
  { id: 'transporte', name: 'Transporte', color: 'var(--chart-6)' },
  { id: 'educacao', name: 'Educação', color: 'var(--chart-7)' },
  { id: 'outros', name: 'Outros', color: 'var(--chart-8)' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!
}

export const GOAL_KINDS = [
  { id: 'trip', name: 'Viagem' },
  { id: 'car', name: 'Carro' },
  { id: 'reserve', name: 'Reserva' },
  { id: 'other', name: 'Outro objetivo' },
] as const

export type GoalKind = (typeof GOAL_KINDS)[number]['id']
