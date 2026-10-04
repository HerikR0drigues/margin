<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORIES } from '@/lib/categories'
import { topRoundedPath, yTicks } from '@/lib/chart'
import { brl, compact, monthLabel, monthShortYear, monthShort } from '@/lib/format'
import { useElementWidth } from '@/composables/useElementWidth'
import type { TrendMonth } from '@/stores/month'

const props = defineProps<{ months: TrendMonth[]; selected: string }>()
const emit = defineEmits<{ select: [key: string] }>()

const box = ref<HTMLElement | null>(null)
const width = useElementWidth(box)
const hover = ref<number | null>(null)

const H = 224
const L = 44
const RIGHT = 12
const T = 12
const B = 26
const ph = H - T - B

const shown = computed(() => {
  const n = width.value >= 560 ? 12 : 6
  const firstData = Math.max(0, props.months.findIndex((m) => m.hasData))
  const start = Math.max(firstData, props.months.length - n)
  return props.months.slice(start)
})
const scale = computed(() => yTicks(Math.max(1000, ...shown.value.map((m) => Math.max(m.total, m.salary)))))
const pw = computed(() => Math.max(width.value - L - RIGHT, 10))
const slot = computed(() => pw.value / Math.max(shown.value.length, 1))
const bw = computed(() => Math.min(14, slot.value * 0.5))
const Y = (v: number) => T + ph * (1 - v / scale.value.ymax)

interface Segment {
  key: string
  y: number
  h: number
  color: string
  top: boolean
}
const columns = computed(() =>
  shown.value.map((m, i) => {
    const cx = L + slot.value * (i + 0.5)
    const segs: Segment[] = []
    let yb = Y(0)
    for (const c of CATEGORIES) {
      const v = m.byCategory[c.id] ?? 0
      if (v <= 0) continue
      const h = (v / scale.value.ymax) * ph
      const top = yb - h
      segs.push({ key: c.id, y: top, h: h - (segs.length ? 2 : 0), color: c.color, top: false })
      yb = top
    }
    if (segs.length) segs[segs.length - 1]!.top = true
    return { m, cx, segs, sel: m.key === props.selected, label: i === 0 || m.key.slice(5, 7) === '01' ? monthShortYear(m.key) : monthShort(m.key) }
  }),
)
const salaryPoints = computed(() => columns.value.filter((c) => c.m.hasData).map((c) => [c.cx, Y(c.m.salary)] as const))
const salaryPath = computed(() => salaryPoints.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(''))

const tipLeft = computed(() => {
  if (hover.value == null) return 0
  const cx = columns.value[hover.value]!.cx
  return cx + 16 + 200 > width.value ? cx - 16 - 200 : cx + 16
})
const hovered = computed(() => (hover.value == null ? null : columns.value[hover.value]!))
const legend = computed(() =>
  CATEGORIES.filter((c) => shown.value.some((m) => (m.byCategory[c.id] ?? 0) > 0)),
)
</script>

<template>
  <div>
    <div ref="box" class="relative w-full">
      <svg
        v-if="width > 0"
        :width="width"
        :height="H"
        :viewBox="`0 0 ${width} ${H}`"
        role="img"
        aria-label="Gastos por categoria e salário nos últimos meses"
        class="block"
      >
        <g v-for="t in scale.ticks" :key="t">
          <line :x1="L" :x2="width - RIGHT" :y1="Y(t)" :y2="Y(t)" :stroke="t === 0 ? 'var(--axis)' : 'var(--border)'" stroke-width="1" />
          <text :x="L - 8" :y="Y(t) + 4" text-anchor="end" class="chart-text">{{ compact(t) }}</text>
        </g>

        <g v-for="(col, i) in columns" :key="col.m.key">
          <rect
            :x="L + slot * i + 2"
            :y="T"
            :width="Math.max(slot - 4, 1)"
            :height="ph"
            rx="8"
            fill="var(--foreground)"
            :fill-opacity="hover === i ? 0.07 : col.sel ? 0.05 : 0"
          />
          <template v-for="s in col.segs" :key="s.key">
            <path v-if="s.top && s.h >= 1" :d="topRoundedPath(col.cx - bw / 2, s.y, bw, s.h, 3)" :fill="s.color" />
            <rect v-else-if="s.h >= 1" :x="col.cx - bw / 2" :y="s.y" :width="bw" :height="s.h" :fill="s.color" />
          </template>
          <text :x="col.cx" :y="H - 8" text-anchor="middle" class="chart-text" :class="{ 'chart-text-strong': col.sel }">
            {{ col.label }}
          </text>
        </g>

        <path v-if="salaryPoints.length > 1" :d="salaryPath" fill="none" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        <g v-for="([x, y], i) in salaryPoints" :key="i">
          <circle :cx="x" :cy="y" r="5" fill="var(--card)" />
          <circle :cx="x" :cy="y" r="3.5" fill="var(--muted-foreground)" />
        </g>

        <rect
          v-for="(col, i) in columns"
          :key="'hit-' + col.m.key"
          :x="L + slot * i"
          :y="T"
          :width="slot"
          :height="H - T"
          fill="#000"
          fill-opacity="0"
          tabindex="0"
          role="button"
          :aria-label="`${monthLabel(col.m.key)}: gastos ${brl(col.m.total)}, salário ${brl(col.m.salary)}. Abrir este mês.`"
          class="cursor-pointer outline-none"
          @pointerenter="hover = i"
          @pointermove="hover = i"
          @pointerleave="hover = null"
          @focus="hover = i"
          @blur="hover = null"
          @click="emit('select', col.m.key)"
          @keydown.enter.prevent="emit('select', col.m.key)"
          @keydown.space.prevent="emit('select', col.m.key)"
        />
      </svg>

      <div
        v-if="hovered"
        class="pointer-events-none absolute top-1 z-10 w-[200px] rounded-xl border bg-popover p-3 text-xs shadow-lg"
        :style="{ left: tipLeft + 'px' }"
      >
        <div class="mb-1.5 text-[13px] font-semibold capitalize">{{ monthLabel(hovered.m.key) }}</div>
        <template v-if="hovered.m.hasData">
          <div v-for="c in [...CATEGORIES].reverse()" :key="c.id">
            <div v-if="(hovered.m.byCategory[c.id] ?? 0) > 0" class="flex items-center gap-2 py-0.5">
              <i class="h-[3px] w-3 shrink-0 rounded-full" :style="{ background: c.color }" />
              <b class="min-w-[78px] font-semibold tabular-nums">{{ brl(hovered.m.byCategory[c.id]!) }}</b>
              <span class="text-muted-foreground">{{ c.name }}</span>
            </div>
          </div>
          <div class="my-1.5 border-t" />
          <div class="flex gap-2 py-0.5"><b class="min-w-[90px] font-semibold tabular-nums">{{ brl(hovered.m.total) }}</b><span class="text-muted-foreground">Gastos</span></div>
          <div class="flex gap-2 py-0.5"><b class="min-w-[90px] font-semibold tabular-nums">{{ brl(hovered.m.salary) }}</b><span class="text-muted-foreground">Salário</span></div>
          <div class="flex gap-2 py-0.5">
            <b class="min-w-[90px] font-semibold tabular-nums">{{ brl(hovered.m.salary - hovered.m.total) }}</b>
            <span class="text-muted-foreground">{{ hovered.m.salary - hovered.m.total < 0 ? 'Faltou' : 'Sobrou' }}</span>
          </div>
        </template>
        <div v-else class="text-muted-foreground">Sem dados neste mês</div>
      </div>
    </div>

    <ul class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <li v-for="c in legend" :key="c.id" class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-[3px]" :style="{ background: c.color }" />{{ c.name }}
      </li>
      <li class="flex items-center gap-1.5">
        <span class="relative h-0.5 w-4 rounded bg-muted-foreground"><span class="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" /></span>
        Salário
      </li>
    </ul>

    <details class="mt-3 text-xs">
      <summary class="cursor-pointer text-muted-foreground">Ver dados em tabela</summary>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full border-collapse tabular-nums">
          <thead>
            <tr class="text-muted-foreground">
              <th class="py-1.5 pr-3 text-left font-medium">Mês</th>
              <th class="px-2 py-1.5 text-right font-medium">Gastos</th>
              <th class="px-2 py-1.5 text-right font-medium">Salário</th>
              <th class="px-2 py-1.5 text-right font-medium">Sobra</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in shown" :key="m.key" class="border-t">
              <td class="whitespace-nowrap py-1.5 pr-3 capitalize">{{ monthLabel(m.key) }}</td>
              <template v-if="m.hasData">
                <td class="whitespace-nowrap px-2 py-1.5 text-right">{{ brl(m.total) }}</td>
                <td class="whitespace-nowrap px-2 py-1.5 text-right">{{ brl(m.salary) }}</td>
                <td class="whitespace-nowrap px-2 py-1.5 text-right" :class="m.salary - m.total < 0 ? 'text-destructive' : ''">{{ brl(m.salary - m.total) }}</td>
              </template>
              <td v-else colspan="3" class="px-2 py-1.5 text-right text-muted-foreground">sem dados</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
