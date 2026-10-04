<script setup lang="ts">
import { computed } from 'vue'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

defineProps<{ min: number; max: number; step?: number; label: string }>()
const model = defineModel<number>({ required: true })
const arr = computed({
  get: () => [model.value],
  set: (v: number[]) => {
    model.value = v[0] ?? 0
  },
})
</script>

<template>
  <SliderRoot v-model="arr" :min="min" :max="max" :step="step ?? 1" class="relative flex h-5 w-full touch-none select-none items-center">
    <SliderTrack class="relative h-1 grow overflow-hidden rounded-full bg-muted">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      :aria-label="label"
      class="block size-4 rounded-full border-2 border-primary bg-card shadow transition-transform hover:scale-110"
    />
  </SliderRoot>
</template>
