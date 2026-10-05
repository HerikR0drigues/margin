<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Car, Pencil, PiggyBank, Plane, Plus, Target, Trash2 } from '@lucide/vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import Slider from '@/components/ui/Slider.vue'
import GoalDialog from '@/components/GoalDialog.vue'
import GoalItemDialog from '@/components/GoalItemDialog.vue'
import ProjectionChart from '@/components/charts/ProjectionChart.vue'
import { GOAL_KINDS } from '@/lib/categories'
import { addMonths, brl, brl0, currentMonthKey, diffMonths, monthLabel, num2, parseMoney, pct } from '@/lib/format'
import { summarizeItem } from '@/lib/goal-items'
import { planInput } from '@/lib/goal-plan'
import { budgetImpact, planGoal, projection, severity } from '@/lib/planner'
import type { Goal, GoalItem } from '@/lib/types'
import { useGoals } from '@/stores/goals'
import { useMonth } from '@/stores/month'

const goals = useGoals()
const month = useMonth()
const NOW = currentMonthKey()

onMounted(() => {
  void goals.load()
  if (month.key !== NOW || !month.entries.length) void month.load(NOW)
})

const icons = { trip: Plane, car: Car, reserve: PiggyBank, other: Target }
const kindName = (k: string) => GOAL_KINDS.find((g) => g.id === k)?.name ?? 'Objetivo'

/** adiamento simulado por meta (em meses), sem salvar */
const shift = ref<Record<string, number>>({})
const shiftOf = (g: Goal) => shift.value[g.id] ?? 0
const dateOf = (g: Goal) => addMonths(g.target_date, shiftOf(g))

const cards = computed(() =>
  goals.goals.map((g) => {
    const saved = goals.savedFor(g)
    const eg = goals.effective(g)
    const base = planGoal(planInput(eg, saved), NOW)
    const sim = planGoal(planInput(eg, saved, dateOf(g)), NOW)
    const goalAmount = base.goalAtDate
    return {
      g,
      saved,
      base,
      sim,
      progress: goalAmount > 0 ? Math.min(saved / goalAmount, 1) : 1,
      points: projection(planInput(eg, saved, dateOf(g)), NOW, sim.monthly),
      items: goals.itemsOf(g.id),
      totals: goals.totals(g, NOW),
      contribution: goals.contributionFor(g.id, NOW),
    }
  }),
)

const impact = computed(() =>
  budgetImpact(month.income, month.total, cards.value.map((c) => c.base.monthly + c.totals.myInstallmentsNow)),
)
const installmentsNow = computed(() => cards.value.reduce((s, c) => s + c.totals.myInstallmentsNow, 0))
const sev = computed(() => severity(impact.value.ratio))
const sevBar = { good: 'bg-brand-500', warn: 'bg-warn', serious: 'bg-serious', crit: 'bg-crit' }

const dialogOpen = ref(false)
const editing = ref<Goal | null>(null)
function openNew() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(g: Goal) {
  editing.value = g
  dialogOpen.value = true
}

const itemOpen = ref(false)
const itemGoalId = ref('')
const editingItem = ref<GoalItem | null>(null)
function openItem(goalId: string, item: GoalItem | null) {
  itemGoalId.value = goalId
  editingItem.value = item
  itemOpen.value = true
}
const itemConfirm = ref<string | null>(null)
let itemTimer: ReturnType<typeof setTimeout> | undefined
function askRemoveItem(i: GoalItem) {
  if (itemConfirm.value === i.id) {
    itemConfirm.value = null
    void goals.removeItem(i.id)
    return
  }
  itemConfirm.value = i.id
  clearTimeout(itemTimer)
  itemTimer = setTimeout(() => (itemConfirm.value = null), 3000)
}
function itemLine(i: GoalItem) {
  const s = summarizeItem(i)
  const refund = s.reimbursement > 0 ? `reembolso ${brl(s.reimbursement)} ${i.reimbursed ? 'recebido' : 'a receber'}` : ''
  if (i.payment === 'cash') {
    return { tag: 'À vista', detail: [s.paid > 0 ? `${brl(s.paid)} de ${brl(s.total)} pagos` : '', refund].filter(Boolean).join(' · ') }
  }
  const done = i.paid_installments
  return {
    tag: `${i.installments}× ${brl(s.installmentAmount)}`,
    detail: `${done} de ${i.installments} parcelas pagas${i.down_payment ? ` · entrada ${brl(i.down_payment)}` : ''}${refund ? ' · ' + refund : ''}`,
  }
}

async function applyShift(g: Goal) {
  await goals.update(g.id, { target_date: dateOf(g) })
  shift.value = { ...shift.value, [g.id]: 0 }
}

const amounts = ref<Record<string, string>>({})
async function contribute(g: Goal) {
  const v = parseMoney(amounts.value[g.id] ?? '')
  if (!Number.isFinite(v) || v <= 0) return
  const prev = goals.contributionFor(g.id, NOW)?.amount ?? 0
  await goals.contribute(g.id, NOW, Math.round((prev + v) * 100) / 100)
  amounts.value = { ...amounts.value, [g.id]: '' }
}

const confirmId = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
function askRemove(g: Goal) {
  if (confirmId.value === g.id) {
    confirmId.value = null
    void goals.remove(g.id)
    return
  }
  confirmId.value = g.id
  clearTimeout(timer)
  timer = setTimeout(() => (confirmId.value = null), 3000)
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Planejamento</h1>
        <p class="mt-1 text-sm text-muted-foreground">Viagem, carro, reserva: quanto guardar por mês e o que isso faz com o seu orçamento.</p>
      </div>
      <Button @click="openNew"><Plus /> Novo objetivo</Button>
    </div>

    <Card v-if="goals.goals.length" class="p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">Peso das metas em {{ monthLabel(NOW) }}</h2>
        <span v-if="month.income > 0" class="text-[13px] font-medium">{{ sev.label }}</span>
      </div>
      <p class="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {{ brl(impact.committed) }}<span class="text-base font-normal text-muted-foreground"> por mês</span>
      </p>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-secondary" role="img" :aria-label="`Metas usam ${Math.round(Math.min(impact.ratio, 9.99) * 100)}% da sobra do mês`">
        <div class="h-full rounded-full transition-[width] duration-500" :class="sevBar[sev.key]" :style="{ width: Math.min(impact.ratio, 1) * 100 + '%' }" />
      </div>
      <dl class="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt class="text-xs text-muted-foreground">Sobra antes das metas</dt>
          <dd class="mt-0.5 font-medium tabular-nums">{{ brl(impact.free) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Metas</dt>
          <dd class="mt-0.5 font-medium tabular-nums">{{ brl(impact.committed) }}</dd>
          <dd v-if="installmentsNow > 0" class="text-xs text-muted-foreground">com {{ brl(installmentsNow) }} de parcelas</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Sobra depois</dt>
          <dd class="mt-0.5 font-medium tabular-nums" :class="impact.leftover < 0 ? 'text-destructive' : ''">{{ brl(impact.leftover) }}</dd>
        </div>
      </dl>
      <p v-if="month.income <= 0" class="mt-3 text-xs text-muted-foreground">Informe o salário na tela do mês para calcular o peso das metas.</p>
    </Card>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card v-for="c in cards" :key="c.g.id" class="grid content-start gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <component :is="icons[c.g.kind]" class="size-4" />
            </span>
            <div class="min-w-0">
              <h3 class="truncate font-medium">{{ c.g.name }}</h3>
              <p class="text-xs text-muted-foreground">{{ kindName(c.g.kind) }} · {{ brl0(c.items.length ? c.totals.total : c.g.target_amount) }}{{ c.g.my_share < 1 ? ` (sua parte ${pct(c.g.my_share, 0)}%)` : '' }} até {{ monthLabel(dateOf(c.g)) }}</p>
            </div>
          </div>
          <div class="flex shrink-0">
            <Button variant="ghost" size="icon-sm" :aria-label="'Editar ' + c.g.name" @click="openEdit(c.g)"><Pencil /></Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :class="confirmId === c.g.id ? 'text-destructive' : ''"
              :aria-label="'Excluir ' + c.g.name"
              :title="confirmId === c.g.id ? 'Clique de novo para excluir' : 'Excluir'"
              @click="askRemove(c.g)"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div>
          <div class="flex items-baseline justify-between text-sm">
            <span class="text-muted-foreground">Guardado</span>
            <span class="font-medium tabular-nums">{{ brl0(c.saved) }} <span class="text-muted-foreground">de {{ brl0(c.base.goalAtDate) }}</span></span>
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div class="h-full rounded-full bg-brand-500 transition-[width] duration-500" :style="{ width: c.progress * 100 + '%' }" />
          </div>
        </div>

        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-xs text-muted-foreground">Guardar por mês</dt>
            <dd class="mt-0.5 text-xl font-semibold tabular-nums">{{ brl(c.sim.monthly) }}</dd>
            <dd class="text-xs text-muted-foreground">em {{ c.sim.months }} {{ c.sim.months === 1 ? 'mês' : 'meses' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Parte da sobra</dt>
            <dd class="mt-0.5 text-xl font-semibold tabular-nums">
              {{ impact.free > 0 ? pct(c.sim.monthly / impact.free, 0) + '%' : '—' }}
            </dd>
            <dd class="text-xs text-muted-foreground">da sobra do mês</dd>
          </div>
        </dl>

        <div v-if="c.sim.mode === 'financed' && c.sim.financed" class="rounded-lg border p-3 text-sm">
          <div class="mb-2 flex items-center gap-2 font-medium">Financiado <Badge variant="primary">entrada + parcelas</Badge></div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><dt class="text-xs text-muted-foreground">Parcela</dt><dd class="font-medium tabular-nums">{{ brl(c.sim.financed.installment) }} × {{ c.sim.financed.installments }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Juros no total</dt><dd class="font-medium tabular-nums">{{ brl0(c.sim.financed.interestTotal) }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Entrada por mês</dt><dd class="font-medium tabular-nums">{{ brl(c.sim.monthly) }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">À vista, por mês</dt><dd class="font-medium tabular-nums">{{ brl(c.sim.cashMonthly ?? 0) }}</dd></div>
          </dl>
          <p class="mt-2 text-xs text-muted-foreground">Depois da compra, a parcela de {{ brl(c.sim.financed.installment) }} entra nos seus gastos mensais.</p>
        </div>

        <div class="rounded-lg border">
          <div class="flex items-center justify-between gap-2 px-3 py-2.5">
            <h4 class="text-sm font-medium">Itens</h4>
            <Button size="sm" variant="ghost" @click="openItem(c.g.id, null)"><Plus /> Adicionar item</Button>
          </div>
          <ul v-if="c.items.length">
            <li v-for="i in c.items" :key="i.id" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t px-3 py-2.5">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium">{{ i.name }}</div>
                <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge :variant="i.payment === 'cash' ? 'outline' : 'primary'">{{ itemLine(i).tag }}</Badge>
                  <span v-if="itemLine(i).detail">{{ itemLine(i).detail }}</span>
                </div>
              </div>
              <div class="text-right text-sm font-medium tabular-nums">{{ brl(summarizeItem(i).total) }}</div>
              <div class="flex items-center">
                <Button variant="ghost" size="icon-sm" :aria-label="'Editar ' + i.name" @click="openItem(c.g.id, i)"><Pencil /></Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :class="itemConfirm === i.id ? 'text-destructive' : ''"
                  :aria-label="'Excluir ' + i.name"
                  :title="itemConfirm === i.id ? 'Clique de novo para excluir' : 'Excluir'"
                  @click="askRemoveItem(i)"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          </ul>
          <p v-else class="border-t px-3 py-3 text-xs text-muted-foreground">
            Sem itens: o app usa o valor total do objetivo. Adicione passagens, hotel e o que mais entrar, cada um com sua forma de pagamento.
          </p>
          <dl v-if="c.items.length" class="grid grid-cols-3 gap-3 border-t px-3 py-2.5 text-xs">
            <div>
              <dt class="text-muted-foreground">Total</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl0(c.totals.total) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">{{ c.g.my_share < 1 ? 'Sua parte' : 'Já pago' }}</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl0(c.g.my_share < 1 ? c.totals.myTotal : c.totals.paid) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Falta pagar</dt>
              <dd class="mt-0.5 font-medium tabular-nums">{{ brl0(c.totals.myRemaining) }}</dd>
            </div>
          </dl>
          <p v-if="c.totals.myInstallmentsNow > 0" class="border-t px-3 py-2.5 text-xs text-muted-foreground">
            Parcelas deste mês: {{ brl(c.totals.myInstallmentsNow) }} (já entram no peso do mês).
          </p>
          <p v-if="c.totals.reimbursement > 0" class="border-t px-3 py-2.5 text-xs text-muted-foreground">
            Reembolsos esperados: {{ brl(c.totals.reimbursement) }} (já abatidos do que você precisa guardar).
          </p>
          <p v-if="c.totals.interest > 0" class="border-t px-3 py-2.5 text-xs text-muted-foreground">
            Juros embutidos nas parcelas: {{ brl(c.totals.interest) }}.
          </p>
        </div>

        <ProjectionChart :points="c.points" :target="c.sim.goalAtDate" :target-label="c.sim.mode === 'financed' ? 'Entrada' : 'Meta'" />

        <div class="grid gap-2">
          <div class="flex items-baseline justify-between text-sm">
            <span class="text-muted-foreground">E se eu adiar?</span>
            <span class="tabular-nums">{{ shiftOf(c.g) === 0 ? 'data atual' : `+${shiftOf(c.g)} ${shiftOf(c.g) === 1 ? 'mês' : 'meses'}` }}</span>
          </div>
          <Slider :model-value="shiftOf(c.g)" :min="0" :max="24" :label="'Adiar ' + c.g.name" @update:model-value="(v) => (shift = { ...shift, [c.g.id]: v })" />
          <div v-if="shiftOf(c.g) > 0" class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-muted-foreground">
              Economiza {{ brl(Math.max(c.base.monthly - c.sim.monthly, 0)) }} por mês
            </span>
            <Button size="sm" variant="secondary" @click="applyShift(c.g)">Aplicar nova data</Button>
          </div>
        </div>

        <form class="flex items-center gap-2 border-t pt-4" @submit.prevent="contribute(c.g)">
          <MoneyInput
            :model-value="amounts[c.g.id] ?? ''"
            :placeholder="c.contribution ? `Já aportou ${num2(c.contribution.amount)} este mês` : 'Aporte deste mês (R$)'"
            :aria-label="'Aporte em ' + c.g.name"
            @update:model-value="(v) => (amounts = { ...amounts, [c.g.id]: v })"
          />
          <Button type="submit" variant="outline">Aportar</Button>
        </form>
      </Card>
    </div>

    <Card v-if="!goals.goals.length" class="flex flex-col items-center gap-3 py-14 text-center">
      <Target class="size-7 text-muted-foreground" />
      <p class="max-w-sm text-sm text-muted-foreground">
        <template v-if="goals.loading">Carregando…</template>
        <template v-else>Cadastre uma viagem, um carro ou uma reserva e veja quanto precisa guardar por mês.</template>
      </p>
      <Button v-if="!goals.loading" @click="openNew"><Plus /> Criar o primeiro objetivo</Button>
    </Card>

    <GoalDialog v-model:open="dialogOpen" :goal="editing" />
    <GoalItemDialog v-model:open="itemOpen" :goal-id="itemGoalId" :item="editingItem" />
  </div>
</template>
