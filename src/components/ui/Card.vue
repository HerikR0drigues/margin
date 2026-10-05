<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('min-w-0 rounded-2xl border bg-card p-4 text-card-foreground sm:p-5', props.class)">
    <slot />
  </div>
</template>
