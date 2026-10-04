<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import Segmented from '@/components/ui/Segmented.vue'
import { addMonths, brl, currentMonthKey, fromMonthInput, num2, parseMoney, toMonthInput } from '@/lib/format'
import type { GoalItem, ItemPayment } from '@/lib/types'
import { useGoals, type GoalItemInput } from '@/stores/goals'

const props = defineProps<{ goalId: string; item: GoalItem | null }>()
const open = defineModel<boolean>('open', { default: false })
const store = useGoals()

const payments = [
  { value: 'cash', label: 'À vista' },
  { value: 'installments', label: 'Parcelado' },
]

const name = ref('')
const payment = ref<ItemPayment>('cash')
const amount = ref('')
const down = ref('')
const n = ref('10')
const parcel = ref('')
const first = ref('')
const paidAmount = ref('')
const paidInstallments = ref('0')
const error = ref('')
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  const i = props.item
  name.value = i?.name ?? ''
  payment.value = i?.payment ?? 'cash'
  amount.value = i ? num2(i.amount) : ''
  down.value = i && i.down_payment ? num2(i.down_payment) : ''
  n.value = i?.installments ? String(i.installments) : '10'
  parcel.value = i?.installment_amount ? num2(i.installment_amount) : ''
  first.value = toMonthInput(i?.first_month ?? addMonths(currentMonthKey(), 1))
  paidAmount.value = i && i.paid_amount ? num2(i.paid_amount) : ''
  paidInstallments.value = String(i?.paid_installments ?? 0)
})

const money = (t: string) => (t.trim() ? parseMoney(t) : 0)

/** Resumo ao vivo: quanto o item custa no total e quanto é juros. */
const preview = computed(() => {
  if (payment.value !== 'installments') return null
  const count = parseInt(n.value, 10)
  const p = money(parcel.value)
  const d = money(down.value)
  const price = money(amount.value)
  if (!(count >= 1) || !(p > 0)) return null
  const total = d + count * p
  return { total, interest: Math.max(total - price, 0) }
})

async function submit() {
  error.value = ''
  const a = parseMoney(amount.value)
  const paid = money(paidAmount.value)
  if (!name.value.trim()) return void (error.value = 'Dê um nome ao item.')
  if (!Number.isFinite(a) || a <= 0) return void (error.value = 'Informe o valor do item.')
  if (!Number.isFinite(paid) || paid < 0) return void (error.value = 'O valor já pago é inválido.')

  let input: GoalItemInput
  if (payment.value === 'cash') {
    if (paid > a) return void (error.value = 'O que você já pagou não pode passar do valor do item.')
    input = {
      name: name.value.trim(), payment: 'cash', amount: round(a), down_payment: 0,
      installments: null, installment_amount: null, first_month: null,
      paid_amount: round(paid), paid_installments: 0,
    }
  } else {
    const d = money(down.value)
    const count = parseInt(n.value, 10)
    const p = parseMoney(parcel.value)
    const done = parseInt(paidInstallments.value, 10) || 0
    if (!Number.isFinite(d) || d < 0 || d > a) return void (error.value = 'A entrada não pode passar do valor do item.')
    if (!(count >= 1 && count <= 120)) return void (error.value = 'Parcelas: de 1 a 120.')
    if (!Number.isFinite(p) || p <= 0) return void (error.value = 'Informe o valor da parcela.')
    if (!/^\d{4}-\d{2}$/.test(first.value)) return void (error.value = 'Escolha o mês da primeira parcela.')
    if (paid > d) return void (error.value = 'O pago da entrada não pode passar da entrada.')
    if (done < 0 || done > count) return void (error.value = 'Parcelas pagas: de 0 até o total de parcelas.')
    input = {
      name: name.value.trim(), payment: 'installments', amount: round(a), down_payment: round(d),
      installments: count, installment_amount: round(p), first_month: fromMonthInput(first.value),
      paid_amount: round(paid), paid_installments: done,
    }
  }
  busy.value = true
  if (props.item) await store.updateItem(props.item.id, input)
  else await store.addItem(props.goalId, input)
  busy.value = false
  open.value = false
}
const round = (v: number) => Math.round(v * 100) / 100
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="item ? 'Editar item' : 'Novo item'"
    description="Cada coisa do objetivo, com a forma de pagamento e o que você já pagou."
  >
    <form class="grid gap-3.5" novalidate @submit.prevent="submit">
      <div class="grid gap-1.5">
        <Label for="i-name">Nome</Label>
        <Input id="i-name" v-model="name" type="text" maxlength="60" autocomplete="off" placeholder="Passagens" />
      </div>
      <div class="grid gap-1.5">
        <Label>Forma de pagamento</Label>
        <Segmented v-model="payment" :options="payments" />
      </div>

      <template v-if="payment === 'cash'">
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-1.5">
            <Label for="i-amount">Valor</Label>
            <MoneyInput id="i-amount" v-model="amount" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-paid">Já paguei</Label>
            <MoneyInput id="i-paid" v-model="paidAmount" />
          </div>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-1.5">
            <Label for="i-amount">Preço à vista</Label>
            <MoneyInput id="i-amount" v-model="amount" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-down">Entrada</Label>
            <MoneyInput id="i-down" v-model="down" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="grid gap-1.5">
            <Label for="i-n">Parcelas</Label>
            <Input id="i-n" v-model="n" type="number" min="1" max="120" inputmode="numeric" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-parcel">Valor da parcela</Label>
            <MoneyInput id="i-parcel" v-model="parcel" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-first">1ª parcela</Label>
            <Input id="i-first" v-model="first" type="month" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-1.5">
            <Label for="i-paid">Entrada já paga</Label>
            <MoneyInput id="i-paid" v-model="paidAmount" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-done">Parcelas já pagas</Label>
            <Input id="i-done" v-model="paidInstallments" type="number" min="0" max="120" inputmode="numeric" />
          </div>
        </div>
        <p v-if="preview" class="text-xs text-muted-foreground">
          Custo total: {{ brl(preview.total) }}<span v-if="preview.interest > 0"> (juros de {{ brl(preview.interest) }})</span>.
        </p>
      </template>

      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button type="submit" :disabled="busy">Salvar</Button>
      </div>
    </form>
  </Dialog>
</template>
