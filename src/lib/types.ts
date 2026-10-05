import type { GoalKind } from './categories'

export type Role = 'admin' | 'member'
export type ExpenseKind = 'fixed' | 'variable'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  display_name: string
  role: Role
  created_at: string
}

export interface MonthEntry {
  id: string
  month: string
  recurring_id: string | null
  name: string
  category: string
  amount: number
  due_day: number
  paid: boolean
  is_estimate: boolean
  skipped: boolean
  on_card: boolean
  /** quanto você vai receber de volta por este gasto */
  reimbursement: number
  reimbursed: boolean
}

export interface Recurring {
  id: string
  name: string
  category: string
  kind: ExpenseKind
  amount: number
  due_day: number
  start_month: string
  end_month: string | null
  on_card: boolean
  reimbursement: number
}

export interface Goal {
  id: string
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
  /** parte do usuário no objetivo: 1 = tudo, 0.5 = dividido com outra pessoa */
  my_share: number
  archived: boolean
}

export type ItemPayment = 'cash' | 'installments'

export interface GoalItem {
  id: string
  goal_id: string
  name: string
  payment: ItemPayment
  amount: number
  down_payment: number
  installments: number | null
  installment_amount: number | null
  first_month: string | null
  paid_amount: number
  paid_installments: number
  reimbursement: number
  reimbursed: boolean
}

export interface Income {
  id: string
  month: string
  description: string
  amount: number
}

export interface Contribution {
  id: string
  goal_id: string
  month: string
  amount: number
}

export interface Invite {
  id: string
  note: string
  email: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_by: string | null
  revoked_at: string | null
}

export interface AccessRequest {
  id: string
  name: string
  email: string
  message: string
  status: RequestStatus
  created_at: string
}

/** PostgREST devolve numeric como número; garantimos o tipo na borda. */
export const toNum = (v: unknown) => Number(v ?? 0)
