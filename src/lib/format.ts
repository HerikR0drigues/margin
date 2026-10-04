// Formatação de valores e helpers de mês.
// Um mês é sempre uma string 'YYYY-MM-01' (igual à coluna `date` do banco).

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl0Fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const numFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const brl = (v: number) => brlFmt.format(v)
export const brl0 = (v: number) => brl0Fmt.format(v)
export const num2 = (v: number) => numFmt.format(v)

/** Valor compacto para eixos: 1,5 mil / 12 mil */
export function compact(v: number) {
  const a = Math.abs(v)
  if (a >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return String(Math.round(v))
}

/** Converte texto digitado ("1.234,56", "99,9", "1234.5") em número. NaN se inválido. */
export function parseMoney(input: string): number {
  let s = String(input).replace(/[^\d,.-]/g, '')
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '')
  else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '')
  return parseFloat(s)
}

/** "0,8" → 0.008 (percentual digitado para fração). NaN se inválido. */
export function parsePercent(input: string): number {
  const v = parseMoney(input)
  return Number.isFinite(v) ? v / 100 : NaN
}

export const pct = (fraction: number, digits = 1) =>
  (fraction * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
export const currentMonthKey = () => monthKeyOf(new Date())

function parts(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { y: y!, m: m! }
}

export function addMonths(key: string, n: number) {
  const { y, m } = parts(key)
  return monthKeyOf(new Date(y, m - 1 + n, 1))
}
/** Quantos meses de `a` até `b` (b - a). */
export function diffMonths(a: string, b: string) {
  const pa = parts(a)
  const pb = parts(b)
  return (pb.y - pa.y) * 12 + (pb.m - pa.m)
}
export const monthName = (key: string) => MONTHS[parts(key).m - 1]!
export const monthShort = (key: string) => SHORT[parts(key).m - 1]!
export const monthYear = (key: string) => parts(key).y
export const monthLabel = (key: string) => `${monthName(key)} de ${monthYear(key)}`
/** 'out ’26' */
export const monthShortYear = (key: string) => `${monthShort(key)} ’${String(monthYear(key)).slice(2)}`
/** Valor para <input type="month"> */
export const toMonthInput = (key: string) => key.slice(0, 7)
export const fromMonthInput = (v: string) => `${v}-01`
