<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  options: { value: string; label: string }[]
  class?: string
}>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <TabsRoot v-model="model" :class="props.class">
    <TabsList class="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5">
      <TabsTrigger
        v-for="o in options"
        :key="o.value"
        :value="o.value"
        :class="
          cn(
            'whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors',
            'data-[state=active]:bg-secondary data-[state=active]:text-foreground',
          )
        "
      >
        {{ o.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
