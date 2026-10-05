<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Switch from '@/components/ui/Switch.vue'
import { GOAL_KINDS, type GoalKind } from '@/lib/categories'
import { addMonths, currentMonthKey, fromMonthInput, num2, parseMoney, parsePercent, toMonthInput } from '@/lib/format'
import type { Goal } from '@/lib/types'
import { useGoals } from '@/stores/goals'

const props = defineProps<{ goal: Goal | null }>()
const open = defineModel<boolean>('open', { default: false })
const store = useGoals()

const name = ref('')
const kind = ref<GoalKind>('trip')
const target = ref('')
const saved = ref('')
const date = ref('')
const yieldText = ref('0')
const financing = ref(false)
const down = ref('')
const installments = ref('48')
const interest = ref('1,8')
const shareMode = ref<'solo' | 'half' | 'custom'>('solo')
const shareText = ref('50')
const error = ref('')
const busy = ref(false)

const pctText = (f: number) => num2(f * 100)

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  const g = props.goal
  name.value = g?.name ?? ''
  kind.value = g?.kind ?? 'trip'
  target.value = g ? num2(g.target_amount) : ''
  saved.value = g ? num2(g.saved_amount) : ''
  date.value = toMonthInput(g?.target_date ?? addMonths(currentMonthKey(), 12))
  yieldText.value = g ? pctText(g.yield_pm) : '0'
  financing.value = g?.financing ?? false
  down.value = g ? num2(g.down_payment) : ''
  installments.value = g?.installments ? String(g.installments) : '48'
  interest.value = g ? pctText(g.interest_pm) : '1,8'
  const share = g?.my_share ?? 1
  shareMode.value = share === 1 ? 'solo' : share === 0.5 ? 'half' : 'custom'
  shareText.value = pctText(share).replace(',00', '')
})

async function submit() {
  error.value = ''
  const t = parseMoney(target.value)
  const s = saved.value.trim() ? parseMoney(saved.value) : 0
  const y = yieldText.value.trim() ? parsePercent(yieldText.value) : 0
  if (!name.value.trim()) return void (error.value = 'Dê um nome ao objetivo.')
  if (!Number.isFinite(t) || t <= 0) return void (error.value = 'Informe o valor total do objetivo.')
  if (!Number.isFinite(s) || s < 0) return void (error.value = 'O valor já guardado é inválido.')
  if (!Number.isFinite(y) || y < 0 || y > 0.05) return void (error.value = 'Rendimento mensal inválido (use algo como 0,8).')
  if (!/^\d{4}-\d{2}$/.test(date.value)) return void (error.value = 'Escolha o mês da meta.')
  let d = 0
  let n: number | null = null
  let i = 0
  if (financing.value) {
    d = down.value.trim() ? parseMoney(down.value) : 0
    n = parseInt(installments.value, 10)
    i = parsePercent(interest.value)
    if (!Number.isFinite(d) || d < 0 || d >= t) return void (error.value = 'A entrada precisa ser menor que o valor total.')
    if (!(n >= 1 && n <= 120)) return void (error.value = 'Parcelas: de 1 a 120.')
    if (!Number.isFinite(i) || i < 0 || i > 0.1) return void (error.value = 'Juros mensais inválidos (use algo como 1,8).')
  }
  const share = shareMode.value === 'solo' ? 1 : shareMode.value === 'half' ? 0.5 : parsePercent(shareText.value)
  if (!Number.isFinite(share) || share <= 0 || share > 1) return void (error.value = 'Sua parte vai de 1% a 100%.')
  busy.value = true
  const input = {
    name: name.value.trim(),
    kind: kind.value,
    target_amount: Math.round(t * 100) / 100,
    saved_amount: Math.round(s * 100) / 100,
    target_date: fromMonthInput(date.value),
    yield_pm: y,
    financing: financing.value,
    down_payment: Math.round(d * 100) / 100,
    installments: n,
    interest_pm: i,
    my_share: Math.round(share * 10000) / 10000,
  }
  if (props.goal) await store.update(props.goal.id, input)
  else await store.create(input)
  busy.value = false
  open.value = false
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="goal ? 'Editar objetivo' : 'Novo objetivo'"
    description="Veja quanto guardar por mês e o peso disso no seu orçamento."
  >
    <form class="grid gap-3.5" novalidate @submit.prevent="submit">
      <div class="grid grid-cols-[minmax(0,1fr)_132px] gap-3">
        <div class="grid gap-1.5">
          <Label for="g-name">Nome</Label>
          <Input id="g-name" v-model="name" type="text" maxlength="60" autocomplete="off" placeholder="Viagem para Lisboa" />
        </div>
        <div class="grid gap-1.5">
          <Label for="g-kind">Tipo</Label>
          <Select id="g-kind" v-model="kind">
            <option v-for="k in GOAL_KINDS" :key="k.id" :value="k.id">{{ k.name }}</option>
          </Select>
        </div>
      </div>
      <div class="grid gap-1.5">
        <Label for="g-share">Quem paga</Label>
        <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Select id="g-share" v-model="shareMode">
            <option value="solo">Só eu</option>
            <option value="half">Eu e outra pessoa (metade cada)</option>
            <option value="custom">Outra divisão</option>
          </Select>
          <div v-if="shareMode === 'custom'" class="flex w-28 items-center gap-2">
            <Input v-model="shareText" type="text" inputmode="decimal" autocomplete="off" aria-label="Sua parte em porcentagem" />
            <span class="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <p v-if="shareMode !== 'solo'" class="text-xs text-muted-foreground">
          Os valores abaixo são o total. O app calcula só a sua parte para guardar por mês.
        </p>
      </div>
      <p class="text-xs text-muted-foreground">
        Com itens cadastrados, só o que virou item entra na conta. A diferença para o valor total aparece como "ainda sem detalhar".
      </p>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5">
          <Label for="g-target">Valor total</Label>
          <MoneyInput id="g-target" v-model="target" />
        </div>
        <div class="grid gap-1.5">
          <Label for="g-saved">Já guardado</Label>
          <MoneyInput id="g-saved" v-model="saved" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-1.5">
          <Label for="g-date">Quero até</Label>
          <Input id="g-date" v-model="date" type="month" />
        </div>
        <div class="grid gap-1.5">
          <Label for="g-yield">Rendimento (% ao mês)</Label>
          <Input id="g-yield" v-model="yieldText" type="text" inputmode="decimal" autocomplete="off" />
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <Label for="g-fin" class="cursor-pointer">
          Financiar
          <span class="block text-xs font-normal text-muted-foreground">Guarda só a entrada e paga parcelas depois.</span>
        </Label>
        <Switch id="g-fin" v-model="financing" />
      </div>
      <div v-if="financing" class="grid grid-cols-3 gap-3">
        <div class="grid gap-1.5">
          <Label for="g-down">Entrada</Label>
          <MoneyInput id="g-down" v-model="down" />
        </div>
        <div class="grid gap-1.5">
          <Label for="g-n">Parcelas</Label>
          <Input id="g-n" v-model="installments" type="number" min="1" max="120" inputmode="numeric" />
        </div>
        <div class="grid gap-1.5">
          <Label for="g-i">Juros (% mês)</Label>
          <Input id="g-i" v-model="interest" type="text" inputmode="decimal" autocomplete="off" />
        </div>
      </div>
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button type="submit" :disabled="busy">Salvar</Button>
      </div>
    </form>
  </Dialog>
</template>
