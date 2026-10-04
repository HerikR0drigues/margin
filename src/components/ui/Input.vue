<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const model = defineModel<string | number>()
</script>

<template>
  <input
    v-model="model"
    :class="
      cn(
        'h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-offset-2 disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
