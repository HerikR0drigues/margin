<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Switch from '@/components/ui/Switch.vue'
import { CATEGORIES } from '@/lib/categories'
import { addMonths, currentMonthKey, monthLabel, num2, parseMoney } from '@/lib/format'
import type { Recurring } from '@/lib/types'
import { useRecurring } from '@/stores/recurring'

const props = defineProps<{ item: Recurring | null }>()
const open = defineModel<boolean>('open', { default: false })
const store = useRecurring()

const name = ref('')
const category = ref('contas')
const kind = ref<string>('fixed')
const amount = ref('')
const dueDay = ref('10')
const onCard = ref(false)
const reimbursement = ref('')
const from = ref('this')
const error = ref('')

const thisMonth = currentMonthKey()
const nextMonth = addMonths(thisMonth, 1)

watch(open, (isOpen) => {
  if (!isOpen || !props.item) return
  error.value = ''
  name.value = props.item.name
  category.value = props.item.category
  kind.value = props.item.kind
  amount.value = num2(props.item.amount)
  dueDay.value = String(props.item.due_day)
  onCard.value = props.item.on_card
  reimbursement.value = props.item.reimbursement ? num2(props.item.reimbursement) : ''
  from.value = 'this'
})

async function submit() {
  if (!props.item) return
  error.value = ''
  const value = parseMoney(amount.value)
  const day = parseInt(String(dueDay.value), 10)
  if (!name.value.trim()) return void (error.value = 'Dê um nome ao gasto.')
  if (!Number.isFinite(value) || value < 0) return void (error.value = 'Informe um valor válido.')
  if (!(day >= 1 && day <= 31)) return void (error.value = 'O dia de vencimento vai de 1 a 31.')
  const reimb = reimbursement.value.trim() ? parseMoney(reimbursement.value) : 0
  if (!Number.isFinite(reimb) || reimb < 0) return void (error.value = 'O reembolso é inválido.')
  if (reimb > value) return void (error.value = 'O reembolso não pode ser maior que o valor do gasto.')
  await store.update(
    props.item.id,
    {
      name: name.value.trim(),
      category: category.value,
      kind: kind.value as 'fixed' | 'variable',
      amount: Math.round(value * 100) / 100,
      due_day: day,
      on_card: onCard.value,
      reimbursement: Math.round(reimb * 100) / 100,
    },
    from.value === 'this' ? thisMonth : nextMonth,
  )
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open" title="Editar recorrente" description="A mudança vale do mês escolhido em diante. Meses já pagos não mudam de valor.">
    <form class="grid gap-3.5" novalidate @submit.prevent="submit">
      <div class="grid gap-1.5">
        <Label>Tipo</Label>
        <Segmented
          v-model="kind"
          :options="[
            { value: 'fixed', label: 'Fixa' },
            { value: 'variable', label: 'Variável' },
          ]"
        />
      </div>
      <div class="grid gap-1.5">
        <Label for="r-name">Nome</Label>
        <Input id="r-name" v-model="name" type="text" maxlength="60" autocomplete="off" />
      </div>
      <div class="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
        <div class="grid gap-1.5">
          <Label for="r-amount">{{ kind === 'variable' ? 'Valor esperado' : 'Valor' }} (R$)</Label>
          <MoneyInput id="r-amount" v-model="amount" />
        </div>
        <div class="grid gap-1.5">
          <Label for="r-day">Vence dia</Label>
          <Input id="r-day" v-model="dueDay" type="number" min="1" max="31" inputmode="numeric" />
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <Label for="r-card" class="cursor-pointer">
          Paga no cartão de crédito
          <span class="block text-xs font-normal text-muted-foreground">Continua contando como gasto. Se já lança a fatura inteira como gasto, não repita aqui.</span>
        </Label>
        <Switch id="r-card" v-model="onCard" />
      </div>
      <div class="grid gap-1.5">
        <Label for="r-reimb">Reembolso esperado (opcional)</Label>
        <MoneyInput id="r-reimb" v-model="reimbursement" />
        <p class="text-xs text-muted-foreground">Quanto vão devolver a você por este gasto. O custo no mês é o valor menos o reembolso.</p>
      </div>
      <div class="grid gap-1.5">
        <Label for="r-cat">Categoria</Label>
        <Select id="r-cat" v-model="category">
          <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.name }}</option>
        </Select>
      </div>
      <div class="grid gap-1.5">
        <Label for="r-from">Aplicar a partir de</Label>
        <Select id="r-from" v-model="from">
          <option value="this">Este mês ({{ monthLabel(thisMonth) }})</option>
          <option value="next">Próximo mês ({{ monthLabel(nextMonth) }})</option>
        </Select>
      </div>
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  </Dialog>
</template>
