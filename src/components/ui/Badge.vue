<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ variant?: 'default' | 'outline' | 'primary' | 'warn'; class?: string }>(),
  { variant: 'default' },
)

const variants = {
  default: 'bg-muted text-muted-foreground',
  outline: 'border text-muted-foreground',
  primary: 'bg-accent text-accent-foreground',
  warn: 'border text-foreground',
}
const classes = computed(() =>
  cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3',
    variants[props.variant],
    props.class,
  ),
)
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
