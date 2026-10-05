<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, CreditCard, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  Pencil, Plus, RotateCcw, SkipForward, Trash2, TriangleAlert,
} from '@lucide/vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import Segmented from '@/components/ui/Segmented.vue'
import EntryDialog from '@/components/EntryDialog.vue'
import MonthSkeleton from '@/components/MonthSkeleton.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import { CATEGORIES, categoryById } from '@/lib/categories'
import { addMonths, brl, brl0, currentMonthKey, monthLabel, monthName, num2, maskMoney, parseMoney } from '@/lib/format'
import { planInput } from '@/lib/goal-plan'
import { budgetImpact, planGoal, severity } from '@/lib/planner'
import type { MonthEntry } from '@/lib/types'
import { useGoals } from '@/stores/goals'
import { useMonth } from '@/stores/month'

const month = useMonth()
const goals = useGoals()
const REAL = currentMonthKey()

onMounted(() => {
  void month.load()
  void goals.load()
})

function go(n: number) {
  void month.load(addMonths(month.key, n))
}

/* ---------- salário ---------- */
const salaryText = ref('')
watch(
  () => [month.key, month.salary] as const,
  () => {
    if (document.activeElement?.id !== 'salary') salaryText.value = month.salary ? num2(month.salary) : ''
  },
  { immediate: true },
)
let salaryTimer: ReturnType<typeof setTimeout> | undefined
function onSalaryInput() {
  salaryText.value = maskMoney(salaryText.value)
  const v = parseMoney(salaryText.value)
  const value = Number.isFinite(v) && v >= 0 ? v : 0
  month.salary = value
  clearTimeout(salaryTimer)
  salaryTimer = setTimeout(() => void month.saveSalary(value), 600)
}
function onSalaryBlur() {
  salaryText.value = month.salary ? num2(month.salary) : ''
}
onBeforeUnmount(() => clearTimeout(salaryTimer))

/* ---------- resumo ---------- */
const ratio = computed(() => (month.income > 0 ? month.total / month.income : month.total > 0 ? Infinity : 0))
const sev = computed(() => severity(ratio.value))
const sevIcon = { good: CircleCheck, warn: TriangleAlert, serious: TriangleAlert, crit: CircleAlert }
const sevText = { good: 'text-brand-300', warn: 'text-warn', serious: 'text-serious', crit: 'text-crit' }
const sevBar = { good: 'bg-brand-500', warn: 'bg-warn', serious: 'bg-serious', crit: 'bg-crit' }
const left = computed(() => month.income - month.total)
const heroParts = computed(() => {
  const [int, dec] = num2(Math.abs(left.value)).split(',')
  return { neg: left.value < 0, int: int ?? '0', dec: dec ?? '00' }
})
const biggest = computed(() => {
  let best: { id: string; value: number } | null = null
  for (const [id, value] of Object.entries(month.byCategory)) if (!best || value > best.value) best = { id, value }
  return best
})
const note = computed(() => {
  if (month.income <= 0) return 'Informe o salário do mês para ver quanto sobra.'
  if (!month.visible.length) return 'Nenhum gasto neste mês ainda.'
  const big = biggest.value
  return `${Math.round(ratio.value * 100)}% do salário vai para gastos fixos.${big ? ` O maior peso é ${categoryById(big.id).name} (${brl0(big.value)}).` : ''}`
})
const delta = computed(() => (month.previousTotal == null ? null : month.total - month.previousTotal))

const plans = computed(() => goals.goals.map((g) => planGoal(planInput(goals.effective(g), goals.savedFor(g)), REAL)))
const impact = computed(() =>
  budgetImpact(
    month.income,
    month.total,
    plans.value.map((p, i) => p.monthly + goals.totals(goals.goals[i]!, month.key, month.hasBill).myInstallmentsNow),
  ),
)

/* ---------- rendas extras ---------- */
const incomeName = ref('')
const incomeAmount = ref('')
const incomeError = ref('')
async function addIncome() {
  incomeError.value = ''
  const v = parseMoney(incomeAmount.value)
  if (!incomeName.value.trim()) return void (incomeError.value = 'Diga de onde veio.')
  if (!Number.isFinite(v) || v <= 0) return void (incomeError.value = 'Informe o valor.')
  await month.addIncome(incomeName.value.trim(), Math.round(v * 100) / 100)
  incomeName.value = ''
  incomeAmount.value = ''
}

/* ---------- gráficos ---------- */
const activeCat = ref<string | null>(null)
const slices = computed(() =>
  CATEGORIES.filter((c) => (month.byCategory[c.id] ?? 0) > 0).map((c) => ({
    id: c.id,
    label: c.name,
    value: month.byCategory[c.id]!,
    color: c.color,
  })),
)
const legendRows = computed(() => [...slices.value].sort((a, b) => b.value - a.value))

/* ---------- lista ---------- */
const filter = ref('all')
const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'A pagar' },
  { value: 'paid', label: 'Pagos' },
]
const rows = computed(() =>
  month.topEntries
    .filter((e) => (filter.value === 'pending' ? !e.paid : filter.value === 'paid' ? e.paid : true))
    .slice()
    .sort((a, b) => a.due_day - b.due_day || a.name.localeCompare(b.name, 'pt-BR')),
)
const billOpen = ref(true)
const skipped = computed(() => month.entries.filter((e) => e.skipped))
function isLate(e: MonthEntry) {
  if (e.paid) return false
  return month.key < REAL || (month.key === REAL && e.due_day < new Date().getDate())
}

const dialogOpen = ref(false)
const editingEntry = ref<MonthEntry | null>(null)
function openNew() {
  editingEntry.value = null
  dialogOpen.value = true
}
function openEdit(e: MonthEntry) {
  editingEntry.value = e
  dialogOpen.value = true
}

const editingAmount = ref<string | null>(null)
const amountText = ref('')
async function startAmount(e: MonthEntry) {
  editingAmount.value = e.id
  amountText.value = num2(e.amount)
  await nextTick()
  const input = document.getElementById('amt-' + e.id) as HTMLInputElement | null
  input?.select()
}
async function commitAmount(e: MonthEntry) {
  if (editingAmount.value !== e.id) return
  editingAmount.value = null
  const v = parseMoney(amountText.value)
  if (!Number.isFinite(v) || v < 0) return
  const value = Math.round(v * 100) / 100
  if (value !== e.amount || e.is_estimate) await month.updateEntry(e, { amount: value })
}

const confirmId = ref<string | null>(null)
let confirmTimer: ReturnType<typeof setTimeout> | undefined
function askRemove(e: MonthEntry) {
  if (confirmId.value === e.id) {
    confirmId.value = null
    void month.removeEntry(e)
    return
  }
  confirmId.value = e.id
  clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => (confirmId.value = null), 3000)
}
</script>

<template>
  <div class="grid gap-4">
    <!-- navegação do mês -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-1.5">
        <Button variant="outline" size="icon" aria-label="Mês anterior" @click="go(-1)"><ChevronLeft /></Button>
        <h1 class="min-w-[10rem] text-center text-xl font-semibold tracking-tight first-letter:uppercase sm:text-2xl">
          {{ monthLabel(month.key) }}
        </h1>
        <Button variant="outline" size="icon" aria-label="Próximo mês" @click="go(1)"><ChevronRight /></Button>
        <Button v-if="month.key !== REAL" variant="ghost" size="sm" @click="month.load(REAL)">Voltar para {{ monthName(REAL) }}</Button>
      </div>
      <Button @click="openNew"><Plus /> Novo gasto</Button>
    </div>

    <MonthSkeleton v-if="month.loading" />
    <template v-else>
    <!-- resumo -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div class="grid content-start gap-4">
        <Card class="p-5 sm:p-6">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-medium text-muted-foreground">
              {{ heroParts.neg ? 'Faltam em' : 'Sobra em' }} {{ monthName(month.key) }}
            </h2>
            <span v-if="month.income > 0" class="inline-flex items-center gap-1.5 text-[13px] font-medium">
              <component :is="sevIcon[sev.key]" class="size-4" :class="sevText[sev.key]" />
              {{ sev.label }}
            </span>
          </div>
          <div class="mt-3 flex items-baseline font-display tracking-tight" aria-live="polite">
            <span class="mr-1.5 text-lg text-muted-foreground">{{ heroParts.neg ? '−R$' : 'R$' }}</span>
            <span class="text-5xl font-semibold leading-none sm:text-6xl">{{ heroParts.int }}</span>
            <span class="text-2xl text-muted-foreground">,{{ heroParts.dec }}</span>
          </div>
          <p class="mt-2 max-w-[52ch] text-sm text-muted-foreground">{{ note }}</p>
          <div
            class="mt-4 h-2 overflow-hidden rounded-full bg-secondary"
            role="img"
            :aria-label="month.income > 0 ? `${sev.label}: ${Math.round(ratio * 100)}% do salário comprometido` : 'Salário não informado'"
          >
            <div class="h-full rounded-full transition-[width] duration-500" :class="sevBar[sev.key]" :style="{ width: Math.min(ratio, 1) * 100 + '%' }" />
          </div>
          <dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4 sm:grid-cols-4">
            <div>
              <dt class="text-xs text-muted-foreground">Salário</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl(month.salary) }}</dd>
              <dd v-if="month.extraIncome > 0" class="mt-0.5 text-xs text-brand-300">+ {{ brl(month.extraIncome) }} extras</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Gastos fixos</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl(month.total) }}</dd>
              <dd v-if="delta != null && Math.abs(delta) >= 0.005" class="mt-0.5 flex items-center gap-1 text-xs" :class="delta > 0 ? 'text-serious' : 'text-good'">
                <component :is="delta > 0 ? ArrowUp : ArrowDown" class="size-3" />
                {{ brl0(Math.abs(delta)) }} vs mês anterior
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Metas por mês</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl(impact.committed) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Depois das metas</dt>
              <dd class="mt-0.5 font-medium tabular-nums" :class="impact.leftover < 0 ? 'text-destructive' : ''">{{ brl(impact.leftover) }}</dd>
            </div>
          </dl>
        </Card>

          <Card>
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-medium">Pagamentos</h2>
              <span class="text-xs text-muted-foreground">
                {{ month.topEntries.length ? `${month.paidCount} de ${month.topEntries.length} pagos` : 'Nenhum gasto' }}
              </span>
            </div>
            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-500" :style="{ width: (month.total ? (month.paidTotal / month.total) * 100 : 0) + '%' }" />
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt class="text-xs text-muted-foreground">Já pago</dt>
                <dd class="mt-0.5 font-medium tabular-nums">{{ brl(month.paidTotal) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">A pagar</dt>
                <dd class="mt-0.5 font-medium tabular-nums">{{ brl(month.pendingTotal) }}</dd>
              </div>
            </dl>
            <p v-if="month.reimbPending > 0 || month.reimbReceived > 0" class="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              Reembolsos:
              <span class="font-medium text-foreground tabular-nums">{{ brl(month.reimbPending) }}</span> a receber
              <span v-if="month.reimbReceived > 0">· {{ brl(month.reimbReceived) }} recebidos</span>
            </p>
            <p v-if="month.cardCount > 0" class="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <CreditCard class="size-3.5" />
              No cartão: <span class="font-medium text-foreground tabular-nums">{{ brl(month.cardTotal) }}</span>
              em {{ month.cardCount }} {{ month.cardCount === 1 ? 'gasto' : 'gastos' }}
            </p>
          </Card>
      </div>
      <div class="grid content-start gap-4">
        <Card>
          <label for="salary" class="text-xs font-medium text-muted-foreground">Salário de {{ monthName(month.key) }}</label>
          <div class="mt-2 flex items-center gap-2 rounded-lg border border-input px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <span class="text-muted-foreground">R$</span>
            <input
              id="salary"
              v-model="salaryText"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0,00"
              class="h-11 min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight tabular-nums outline-none"
              @input="onSalaryInput"
              @blur="onSalaryBlur"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
          </div>
          <p class="mt-2 text-xs text-muted-foreground">Meses novos começam com o salário do mês anterior.</p>
        </Card>
        <Card>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-medium">Rendas extras</h2>
            <span v-if="month.extraIncome > 0" class="text-sm font-medium tabular-nums text-brand-300">+ {{ brl(month.extraIncome) }}</span>
          </div>
          <ul v-if="month.incomes.length" class="mt-2">
            <li v-for="inc in month.incomes" :key="inc.id" class="flex items-center justify-between gap-2 border-t py-2 text-sm first:border-t-0">
              <span class="min-w-0 truncate">{{ inc.description }}</span>
              <span class="flex shrink-0 items-center gap-1">
                <span class="font-medium tabular-nums">{{ brl(inc.amount) }}</span>
                <Button variant="ghost" size="icon-sm" :aria-label="'Remover ' + inc.description" @click="month.removeIncome(inc.id)"><Trash2 /></Button>
              </span>
            </li>
          </ul>
          <p v-else class="mt-1 text-xs text-muted-foreground">Pix recebido, bônus, venda... entra na sobra deste mês.</p>
          <form class="mt-3 grid gap-2" novalidate @submit.prevent="addIncome">
            <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-2">
              <Input v-model="incomeName" type="text" maxlength="60" autocomplete="off" placeholder="Ex.: Pix recebido" aria-label="Descrição da renda extra" />
              <MoneyInput v-model="incomeAmount" aria-label="Valor da renda extra" />
            </div>
            <p v-if="incomeError" class="text-xs text-destructive" role="alert">{{ incomeError }}</p>
            <Button type="submit" variant="outline" size="sm" class="justify-self-start"><Plus /> Adicionar</Button>
          </form>
        </Card>
      </div>
    </div>

    <!-- gráficos -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <Card>
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 class="text-sm font-medium">Mês a mês</h2>
          <span class="text-xs text-muted-foreground">Clique numa coluna para abrir o mês</span>
        </div>
        <TrendChart :months="month.trend" :selected="month.key" @select="(k) => month.load(k)" />
      </Card>
      <Card>
        <h2 class="mb-4 text-sm font-medium">Gastos por categoria</h2>
        <template v-if="slices.length">
          <DonutChart
            v-model:active="activeCat"
            :slices="slices"
            center-label="Gastos fixos"
            :center-value="brl0(month.total)"
            :center-note="month.income > 0 ? Math.round(ratio * 100) + '% da renda' : ''"
            :ariaLabel="`Gastos de ${monthLabel(month.key)} por categoria. Total ${brl(month.total)}.`"
          />
          <ul class="mt-4 grid gap-0.5">
            <li
              v-for="s in legendRows"
              :key="s.id"
              tabindex="0"
              class="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 outline-offset-0 hover:bg-muted focus-visible:bg-muted"
              :class="activeCat === s.id ? 'bg-muted' : ''"
              @pointerenter="activeCat = s.id"
              @pointerleave="activeCat = null"
              @focus="activeCat = s.id"
              @blur="activeCat = null"
            >
              <span class="flex min-w-0 items-center gap-2.5">
                <span class="size-2.5 shrink-0 rounded-full" :style="{ background: s.color }" />
                <span class="truncate">{{ s.label }}</span>
              </span>
              <span class="text-right">
                <b class="block font-medium tabular-nums">{{ brl(s.value) }}</b>
                <small class="block text-xs text-muted-foreground">
                  {{ month.income > 0 ? Math.round((s.value / month.income) * 100) + '% da renda' : Math.round((s.value / month.total) * 100) + '% dos gastos' }}
                </small>
              </span>
            </li>
          </ul>
        </template>
        <p v-else class="py-10 text-center text-sm text-muted-foreground">Sem gastos neste mês.</p>
      </Card>

    </div>

    <!-- lista -->
    <Card class="p-0 sm:p-0">
      <div class="flex flex-wrap items-center justify-between gap-3 p-4 pb-3 sm:px-5">
        <h2 class="text-sm font-medium">Gastos de {{ monthName(month.key) }}</h2>
        <Segmented v-model="filter" :options="filters" />
      </div>
      <p v-if="month.estimateCount > 0" class="mx-4 mb-2 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground sm:mx-5">
        {{ month.estimateCount }} {{ month.estimateCount === 1 ? 'valor estimado' : 'valores estimados' }} (ex.: cartão). Clique no valor para informar o real.
      </p>
      <ul>
        <li
          v-for="e in rows"
          :key="e.id"
          class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t px-4 py-3 sm:px-5"
        >
          <button
            type="button"
            class="grid size-6 place-items-center rounded-full border-2 transition-colors"
            :class="e.paid ? 'border-primary bg-primary text-primary-foreground' : 'border-axis text-transparent hover:border-primary'"
            :aria-pressed="e.paid"
            :aria-label="(e.paid ? 'Marcar como pendente: ' : 'Marcar como pago: ') + e.name"
            @click="month.togglePaid(e)"
          >
            <Check class="size-3.5" />
          </button>
          <div class="min-w-0">
            <div class="truncate font-medium" :class="e.paid ? 'text-muted-foreground' : ''">{{ e.name }}</div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span class="size-2 rounded-full" :style="{ background: categoryById(e.category).color }" />
              <span>{{ categoryById(e.category).name }}</span>
              <span>vence dia {{ e.due_day }}</span>
              <Badge v-if="e.recurring_id" variant="outline">recorrente</Badge>
              <Badge v-else>avulso</Badge>
              <Badge v-if="e.card_bill" variant="primary"><CreditCard /> fatura do cartão</Badge>
              <Badge v-else-if="e.on_card" variant="outline"><CreditCard /> cartão</Badge>
              <Badge v-if="e.is_estimate" variant="primary">estimado</Badge>
              <Badge v-if="isLate(e)" variant="warn"><TriangleAlert class="text-serious" /> atrasado</Badge>
              <span v-if="e.paid">pago</span>
            </div>
          </div>
          <div class="text-right">
            <input
              v-if="editingAmount === e.id"
              :id="'amt-' + e.id"
              v-model="amountText"
              type="text"
              inputmode="numeric"
              :aria-label="'Valor de ' + e.name"
              class="h-8 w-28 rounded-md border border-input bg-transparent px-2 text-right tabular-nums"
              @input="amountText = maskMoney(amountText)"
              @blur="commitAmount(e)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @keydown.esc="editingAmount = null"
            />
            <button
              v-else
              type="button"
              class="rounded-md px-2 py-1 font-medium tabular-nums hover:bg-muted"
              :class="e.is_estimate ? 'text-primary-text' : e.paid ? 'text-muted-foreground' : ''"
              :title="e.is_estimate ? 'Estimativa: clique para informar o valor real' : 'Clique para corrigir o valor'"
              @click="startAmount(e)"
            >
              <span v-if="e.is_estimate">~</span>{{ brl(e.amount) }}
            </button>
            <button
              v-if="e.reimbursement > 0 && editingAmount !== e.id"
              type="button"
              class="mt-0.5 block w-full text-right text-xs tabular-nums hover:underline"
              :class="e.reimbursed ? 'text-good' : 'text-primary-text'"
              :title="e.reimbursed ? 'Reembolso recebido. Clique para voltar a pendente' : 'Clique quando o reembolso cair na conta'"
              @click="month.toggleReimbursed(e)"
            >
              − {{ brl(Math.min(e.reimbursement, e.amount)) }} reembolso · {{ e.reimbursed ? 'recebido' : 'a receber' }}
            </button>
          </div>
          <div class="flex items-center">
            <Button variant="ghost" size="icon-sm" :aria-label="'Editar ' + e.name" @click="openEdit(e)"><Pencil /></Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :class="confirmId === e.id ? 'text-destructive' : ''"
              :aria-label="(e.recurring_id ? 'Pular neste mês: ' : 'Excluir: ') + e.name"
              :title="confirmId === e.id ? 'Clique de novo para confirmar' : e.recurring_id ? 'Pular neste mês' : 'Excluir'"
              @click="askRemove(e)"
            >
              <component :is="e.recurring_id ? SkipForward : Trash2" />
            </Button>
          </div>

          <!-- o que está dentro da fatura -->
          <div v-if="e.card_bill && e.id === month.bills[0]?.id" class="col-span-full mt-3 rounded-lg border bg-muted/30">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
              :aria-expanded="billOpen"
              @click="billOpen = !billOpen"
            >
              <span class="flex items-center gap-1.5 font-medium">
                <component :is="billOpen ? ChevronDown : ChevronRight" class="size-3.5" />
                {{ month.insideRows.length }} {{ month.insideRows.length === 1 ? 'item dentro' : 'itens dentro' }} da fatura
              </span>
              <span class="tabular-nums text-muted-foreground">
                Detalhado {{ brl(month.insideGross) }} · Sem detalhe {{ brl(month.undetailed) }}
              </span>
            </button>
            <div class="mx-3 mb-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="img" :aria-label="`${Math.round((month.insideGross / Math.max(month.cardTotal, 1)) * 100)}% da fatura detalhada`">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-500" :style="{ width: Math.min(month.insideGross / Math.max(month.cardTotal, 1), 1) * 100 + '%' }" />
            </div>
            <ul v-if="billOpen && month.insideRows.length">
              <li v-for="r in month.insideRows" :key="r.id" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t px-3 py-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 truncate text-sm">
                    <span class="size-2 shrink-0 rounded-full" :style="{ background: categoryById(r.category).color }" />
                    <span class="truncate">{{ r.name }}</span>
                    <span v-if="r.sub" class="shrink-0 text-xs text-muted-foreground">{{ r.sub }}</span>
                  </div>
                </div>
                <div class="text-right text-sm tabular-nums">
                  {{ brl(r.gross) }}
                  <button
                    v-if="r.reimbursement > 0 && r.entry"
                    type="button"
                    class="block w-full text-right text-xs hover:underline"
                    :class="r.reimbursed ? 'text-good' : 'text-primary-text'"
                    @click="month.toggleReimbursed(r.entry!)"
                  >
                    − {{ brl(r.reimbursement) }} reembolso · {{ r.reimbursed ? 'recebido' : 'a receber' }}
                  </button>
                  <span v-else-if="r.reimbursement > 0" class="block text-xs text-primary-text">− {{ brl(r.reimbursement) }} reembolso</span>
                </div>
                <div class="flex w-8 justify-end">
                  <Button v-if="r.entry" variant="ghost" size="icon-sm" :aria-label="'Editar ' + r.name" @click="openEdit(r.entry!)"><Pencil /></Button>
                </div>
              </li>
            </ul>
            <p v-if="billOpen && !month.insideRows.length" class="border-t px-3 py-2 text-xs text-muted-foreground">
              Nada detalhado ainda. Marque gastos como "No cartão" para ver o que há dentro da fatura.
            </p>
          </div>
        </li>
      </ul>
      <div v-if="!rows.length" class="border-t px-5 py-10 text-center text-sm text-muted-foreground">
        <template v-if="month.loading">Carregando…</template>
        <template v-else-if="month.visible.length">Nada por aqui com este filtro.</template>
        <template v-else>
          Nenhum gasto neste mês.
          <button type="button" class="font-medium text-primary-text underline-offset-4 hover:underline" @click="openNew">Adicionar o primeiro</button>
        </template>
      </div>
      <div class="flex items-center justify-between border-t px-4 py-3 text-sm font-medium sm:px-5">
        <span>Total do mês</span>
        <span class="tabular-nums">{{ brl(month.total) }}</span>
      </div>
      <div v-if="skipped.length" class="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Pulados neste mês:
        <button
          v-for="e in skipped"
          :key="e.id"
          type="button"
          class="ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground hover:bg-muted"
          :title="'Restaurar ' + e.name"
          @click="month.restoreEntry(e)"
        >
          <RotateCcw class="size-3" /> {{ e.name }}
        </button>
      </div>
    </Card>
    </template>

    <EntryDialog v-model:open="dialogOpen" :entry="editingEntry" />
  </div>
</template>
