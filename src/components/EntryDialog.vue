<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import { CATEGORIES } from '@/lib/categories'
import { num2, parseMoney } from '@/lib/format'
import type { MonthEntry } from '@/lib/types'
import { useMonth } from '@/stores/month'

const props = defineProps<{ entry?: MonthEntry | null; recurringOnly?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const month = useMonth()

type Mode = 'fixed' | 'variable' | 'oneoff'
const mode = ref<Mode>('fixed')
const name = ref('')
const category = ref('contas')
const amount = ref('')
const dueDay = ref('10')
const error = ref('')
const saving = ref(false)

const editing = computed(() => !!props.entry)
const modes = computed(() => {
  const list = [
    { value: 'fixed', label: 'Fixa' },
    { value: 'variable', label: 'Variável' },
    { value: 'oneoff', label: 'Só este mês' },
  ]
  return props.recurringOnly ? list.slice(0, 2) : list
})
const hint = computed(() => {
  if (editing.value) return 'Isto muda só este mês. Para mudar nos próximos, edite em Recorrentes.'
  if (mode.value === 'fixed') return 'Repete todo mês com o mesmo valor (aluguel, internet, assinaturas).'
  if (mode.value === 'variable')
    return 'Repete todo mês, mas o valor muda (cartão, luz). Entra como estimativa pela média dos últimos meses e você confirma o valor real.'
  return 'Vale só para este mês (um conserto, um presente).'
})
const amountLabel = computed(() => (mode.value === 'variable' && !editing.value ? 'Valor esperado' : 'Valor'))

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  if (props.entry) {
    name.value = props.entry.name
    category.value = props.entry.category
    amount.value = num2(props.entry.amount)
    dueDay.value = String(props.entry.due_day)
  } else {
    mode.value = 'fixed'
    name.value = ''
    category.value = 'contas'
    amount.value = ''
    dueDay.value = '10'
  }
})

async function submit() {
  error.value = ''
  const value = parseMoney(amount.value)
  const day = parseInt(String(dueDay.value), 10)
  if (!name.value.trim()) return void (error.value = 'Dê um nome ao gasto.')
  if (!Number.isFinite(value) || value < 0) return void (error.value = 'Informe um valor válido.')
  if (!(day >= 1 && day <= 31)) return void (error.value = 'O dia de vencimento vai de 1 a 31.')
  const base = { name: name.value.trim(), category: category.value, amount: Math.round(value * 100) / 100, due_day: day }
  saving.value = true
  try {
    if (props.entry) await month.updateEntry(props.entry, base)
    else if (mode.value === 'oneoff') await month.addOneOff(base)
    else await month.addRecurring({ ...base, kind: mode.value })
    open.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" :title="editing ? 'Editar gasto' : 'Novo gasto'">
    <form class="grid gap-3.5" novalidate @submit.prevent="submit">
      <div v-if="!editing" class="grid gap-1.5">
        <Label>Tipo</Label>
        <Segmented v-model="mode" :options="modes" />
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">{{ hint }}</p>

      <div class="grid gap-1.5">
        <Label for="e-name">Nome</Label>
        <Input id="e-name" v-model="name" type="text" maxlength="60" placeholder="Ex.: Internet" autocomplete="off" />
      </div>
      <div class="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
        <div class="grid gap-1.5">
          <Label for="e-amount">{{ amountLabel }} (R$)</Label>
          <Input id="e-amount" v-model="amount" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" />
        </div>
        <div class="grid gap-1.5">
          <Label for="e-day">Vence dia</Label>
          <Input id="e-day" v-model="dueDay" type="number" min="1" max="31" inputmode="numeric" />
        </div>
      </div>
      <div class="grid gap-1.5">
        <Label for="e-cat">Categoria</Label>
        <Select id="e-cat" v-model="category">
          <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.name }}</option>
        </Select>
      </div>

      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button type="submit" :disabled="saving">{{ editing ? 'Salvar' : 'Adicionar' }}</Button>
      </div>
    </form>
  </Dialog>
</template>
