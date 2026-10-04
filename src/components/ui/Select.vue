<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const model = defineModel<string>()
</script>

<template>
  <select
    v-model="model"
    :class="
      cn(
        'h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm outline-offset-2',
        props.class,
      )
    "
  >
    <slot />
  </select>
</template>
