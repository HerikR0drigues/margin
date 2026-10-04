<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue'
import { useToast } from '@/stores/toast'

const toast = useToast()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:items-end md:pb-6"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="t in toast.items"
      :key="t.id"
      class="pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-sm shadow-lg"
    >
      <CircleAlert v-if="t.kind === 'error'" class="mt-0.5 size-4 shrink-0 text-destructive" />
      <CircleCheck v-else class="mt-0.5 size-4 shrink-0 text-good" />
      <span>{{ t.title }}</span>
    </div>
  </div>
</template>
