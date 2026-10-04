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
  archived: boolean
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
