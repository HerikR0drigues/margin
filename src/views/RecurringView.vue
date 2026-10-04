<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Repeat, Square } from '@lucide/vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import EntryDialog from '@/components/EntryDialog.vue'
import RecurringDialog from '@/components/RecurringDialog.vue'
import { categoryById } from '@/lib/categories'
import { addMonths, brl, currentMonthKey, monthLabel } from '@/lib/format'
import type { Recurring } from '@/lib/types'
import { useRecurring } from '@/stores/recurring'

const store = useRecurring()
onMounted(() => void store.load())

const NOW = currentMonthKey()
const active = computed(() => store.items.filter((r) => !r.end_month || r.end_month >= NOW))
const ended = computed(() => store.items.filter((r) => r.end_month && r.end_month < NOW))
const monthlyTotal = computed(() => active.value.reduce((s, r) => s + r.amount, 0))

const newOpen = ref(false)
const editOpen = ref(false)
const editing = ref<Recurring | null>(null)
function edit(r: Recurring) {
  editing.value = r
  editOpen.value = true
}

const confirmId = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
function askEnd(r: Recurring) {
  if (confirmId.value === r.id) {
    confirmId.value = null
    // encerra a partir do próximo mês: o mês atual já está lançado
    void store.end(r.id, addMonths(NOW, 1))
    return
  }
  confirmId.value = r.id
  clearTimeout(timer)
  timer = setTimeout(() => (confirmId.value = null), 3500)
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Gastos recorrentes</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Os modelos que se repetem todo mês. {{ active.length }} ativos, {{ brl(monthlyTotal) }} por mês em valores base.
        </p>
      </div>
      <Button @click="newOpen = true"><Plus /> Nova recorrente</Button>
    </div>

    <Card class="p-0 sm:p-0">
      <ul>
        <li
          v-for="(r, i) in active"
          :key="r.id"
          class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-3 sm:px-5"
          :class="i ? 'border-t' : ''"
        >
          <div class="min-w-0">
            <div class="truncate font-medium">{{ r.name }}</div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span class="size-2 rounded-full" :style="{ background: categoryById(r.category).color }" />
              <span>{{ categoryById(r.category).name }}</span>
              <span>vence dia {{ r.due_day }}</span>
              <Badge :variant="r.kind === 'variable' ? 'primary' : 'outline'">{{ r.kind === 'variable' ? 'variável' : 'fixa' }}</Badge>
              <span v-if="r.end_month">até {{ monthLabel(r.end_month) }}</span>
            </div>
          </div>
          <div class="text-right font-medium tabular-nums">
            <span v-if="r.kind === 'variable'" class="text-muted-foreground">~</span>{{ brl(r.amount) }}
          </div>
          <div class="flex items-center">
            <Button variant="ghost" size="icon-sm" :aria-label="'Editar ' + r.name" @click="edit(r)"><Pencil /></Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :class="confirmId === r.id ? 'text-destructive' : ''"
              :aria-label="'Encerrar ' + r.name"
              :title="confirmId === r.id ? 'Clique de novo para encerrar a partir do próximo mês' : 'Encerrar a partir do próximo mês'"
              @click="askEnd(r)"
            >
              <Square />
            </Button>
          </div>
        </li>
      </ul>
      <div v-if="!active.length" class="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
        <Repeat class="size-6" />
        <span v-if="store.loading">Carregando…</span>
        <span v-else>Nenhuma recorrente ainda. Cadastre internet, aluguel, assinaturas e o cartão.</span>
      </div>
    </Card>

    <Card v-if="ended.length">
      <h2 class="text-sm font-medium">Encerradas</h2>
      <ul class="mt-2 grid gap-1 text-sm text-muted-foreground">
        <li v-for="r in ended" :key="r.id" class="flex justify-between gap-3">
          <span class="truncate">{{ r.name }}</span>
          <span class="shrink-0">até {{ monthLabel(r.end_month!) }}</span>
        </li>
      </ul>
    </Card>

    <EntryDialog v-model:open="newOpen" recurring-only />
    <RecurringDialog v-model:open="editOpen" :item="editing" />
  </div>
</template>
