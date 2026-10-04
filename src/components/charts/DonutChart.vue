<script setup lang="ts">
import { computed } from 'vue'

export interface DonutSlice {
  id: string
  label: string
  value: number
  color: string
}

const props = defineProps<{
  slices: DonutSlice[]
  centerLabel: string
  centerValue: string
  centerNote?: string
  ariaLabel: string
}>()
const active = defineModel<string | null>('active', { default: null })

const SIZE = 176
const STROKE = 12
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const MID = SIZE / 2

const total = computed(() => props.slices.reduce((s, x) => s + x.value, 0))
const arcs = computed(() => {
  let acc = 0
  const gap = props.slices.length > 1 ? 2 : 0
  return props.slices.map((s) => {
    const len = (C * s.value) / total.value
    const vis = Math.max(len - gap, 0.8)
    const arc = { ...s, dash: `${vis} ${C - vis}`, offset: -acc }
    acc += len
    return arc
  })
})
const activeSlice = computed(() => props.slices.find((s) => s.id === active.value) ?? null)
</script>

<template>
  <div class="relative mx-auto" :style="{ width: SIZE + 'px', height: SIZE + 'px' }">
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" :width="SIZE" :height="SIZE" role="img" :aria-label="ariaLabel" class="block">
      <circle :cx="MID" :cy="MID" :r="R" fill="none" stroke="var(--border)" :stroke-width="STROKE" />
      <g :transform="`rotate(-90 ${MID} ${MID})`">
        <circle
          v-for="a in arcs"
          :key="a.id"
          :cx="MID"
          :cy="MID"
          :r="R"
          fill="none"
          :stroke="a.color"
          :stroke-width="active === a.id ? STROKE + 3 : STROKE"
          :stroke-dasharray="a.dash"
          :stroke-dashoffset="a.offset"
          :style="{ opacity: active && active !== a.id ? 0.3 : 1, transition: 'opacity .15s, stroke-width .15s' }"
        />
        <circle
          v-for="a in arcs"
          :key="'hit-' + a.id"
          :cx="MID"
          :cy="MID"
          :r="R"
          fill="none"
          stroke="#000"
          stroke-opacity="0"
          :stroke-width="34"
          :stroke-dasharray="a.dash"
          :stroke-dashoffset="a.offset"
          @pointerenter="active = a.id"
          @pointerleave="active = null"
        />
      </g>
    </svg>
    <div class="pointer-events-none absolute inset-0 grid place-content-center gap-0.5 px-10 text-center">
      <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {{ activeSlice ? activeSlice.label : centerLabel }}
      </span>
      <b class="font-display text-[22px] font-bold leading-none tracking-tight">
        {{ activeSlice ? activeSlice.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : centerValue }}
      </b>
      <span class="min-h-4 text-[11px] text-muted-foreground">
        {{ activeSlice ? Math.round((activeSlice.value / total) * 100) + '% dos gastos' : centerNote }}
      </span>
    </div>
  </div>
</template>
