<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { maskMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const model = defineModel<string>({ default: '' })

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  model.value = maskMoney(el.value)
  el.value = model.value
}
</script>

<template>
  <div class="relative">
    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
    <input
      :value="model"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="0,00"
      v-bind="$attrs"
      :class="
        cn(
          'h-9 w-full min-w-0 rounded-lg border border-input bg-card pl-9 pr-3 text-sm tabular-nums outline-offset-2 disabled:opacity-50',
          props.class,
        )
      "
      @input="onInput"
    />
  </div>
</template>
