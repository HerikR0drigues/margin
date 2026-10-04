import type { Goal } from './types'
import type { PlanInput } from './planner'

/** Converte uma meta do banco no formato que o planejador entende. */
export function planInput(goal: Goal, saved: number, targetDate = goal.target_date): PlanInput {
  return {
    targetAmount: goal.target_amount,
    savedAmount: saved,
    targetDate,
    yieldPm: goal.yield_pm,
    financing: goal.financing,
    downPayment: goal.down_payment,
    installments: goal.installments,
    interestPm: goal.interest_pm,
  }
}
