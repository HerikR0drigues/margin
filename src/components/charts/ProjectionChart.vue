<script setup lang="ts">
import { computed, ref } from 'vue'
import { yTicks } from '@/lib/chart'
import { brl, compact, monthLabel, monthShortYear } from '@/lib/format'
import { useElementWidth } from '@/composables/useElementWidth'
import type { ProjectionPoint } from '@/lib/planner'

const props = defineProps<{ points: ProjectionPoint[]; target: number; targetLabel: string }>()

const box = ref<HTMLElement | null>(null)
const width = useElementWidth(box)
const hover = ref<number | null>(null)

const H = 150
const L = 40
const RIGHT = 10
const T = 14
const B = 22
const ph = H - T - B

const scale = computed(() => yTicks(Math.max(props.target, ...props.points.map((p) => p.balance), 1) * 1.02))
const pw = computed(() => Math.max(width.value - L - RIGHT, 10))
const X = (i: number) => L + (props.points.length <= 1 ? 0 : (pw.value * i) / (props.points.length - 1))
const Y = (v: number) => T + ph * (1 - v / scale.value.ymax)

const linePath = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.balance)}`).join(''))
const areaPath = computed(() => {
  if (!props.points.length) return ''
  const last = props.points.length - 1
  return `${linePath.value}L${X(last)},${Y(0)}L${X(0)},${Y(0)}Z`
})
const xLabels = computed(() => {
  const n = props.points.length
  if (n === 0) return []
  const idx = n <= 2 ? [0, n - 1] : [0, Math.round((n - 1) / 2), n - 1]
  return [...new Set(idx)].map((i) => ({ i, text: monthShortYear(props.points[i]!.month), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }))
})
const ticks = computed(() => scale.value.ticks.filter((_, i, a) => a.length <= 4 || i % 2 === 0))

function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const x = e.clientX - rect.left - L
  const n = props.points.length
  if (n < 2) return
  hover.value = Math.min(n - 1, Math.max(0, Math.round((x / pw.value) * (n - 1))))
}
const hp = computed(() => (hover.value == null ? null : props.points[hover.value]!))
const tipLeft = computed(() => {
  if (hover.value == null) return 0
  const x = X(hover.value)
  return x + 12 + 140 > width.value ? x - 12 - 140 : x + 12
})
</script>

<template>
  <div ref="box" class="relative w-full">
    <svg v-if="width > 0" :width="width" :height="H" :viewBox="`0 0 ${width} ${H}`" role="img" aria-label="Projeção do valor guardado até a data-alvo" class="block touch-none">
      <g v-for="t in ticks" :key="t">
        <line :x1="L" :x2="width - RIGHT" :y1="Y(t)" :y2="Y(t)" :stroke="t === 0 ? 'var(--axis)' : 'var(--border)'" stroke-width="1" />
        <text :x="L - 6" :y="Y(t) + 4" text-anchor="end" class="chart-text">{{ compact(t) }}</text>
      </g>
      <line :x1="L" :x2="width - RIGHT" :y1="Y(target)" :y2="Y(target)" stroke="var(--muted-foreground)" stroke-width="1" />
      <text :x="width - RIGHT" :y="Y(target) - 4" text-anchor="end" class="chart-text">{{ targetLabel }}</text>

      <path :d="areaPath" fill="var(--primary)" fill-opacity="0.1" />
      <path :d="linePath" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
      <g v-if="points.length">
        <circle :cx="X(points.length - 1)" :cy="Y(points[points.length - 1]!.balance)" r="5" fill="var(--card)" />
        <circle :cx="X(points.length - 1)" :cy="Y(points[points.length - 1]!.balance)" r="3.5" fill="var(--primary)" />
      </g>

      <g v-if="hp && hover != null">
        <line :x1="X(hover)" :x2="X(hover)" :y1="T" :y2="Y(0)" stroke="var(--muted-foreground)" stroke-width="1" />
        <circle :cx="X(hover)" :cy="Y(hp.balance)" r="5" fill="var(--card)" />
        <circle :cx="X(hover)" :cy="Y(hp.balance)" r="3.5" fill="var(--primary)" />
      </g>

      <text v-for="l in xLabels" :key="l.i" :x="X(l.i)" :y="H - 6" :text-anchor="l.anchor" class="chart-text">{{ l.text }}</text>

      <rect :x="L" :y="T" :width="pw" :height="ph + 8" fill="#000" fill-opacity="0" @pointermove="onMove" @pointerleave="hover = null" />
    </svg>
    <div
      v-if="hp"
      class="pointer-events-none absolute top-0 z-10 w-[140px] rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md"
      :style="{ left: tipLeft + 'px' }"
    >
      <b class="block text-[13px] font-semibold tabular-nums">{{ brl(hp.balance) }}</b>
      <span class="text-muted-foreground capitalize">{{ monthLabel(hp.month) }}</span>
    </div>
  </div>
</template>
