<script setup lang="ts">
// Esqueleto da tela do mês: mesmo desenho do conteúdo real, para a página não "pular" ao carregar.
import Card from '@/components/ui/Card.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
</script>

<template>
  <div class="grid gap-4" role="status" aria-busy="true" aria-label="Carregando o mês">
    <!-- resumo -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <Card class="p-5 sm:p-6">
        <div class="flex items-center justify-between">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-4 w-20" />
        </div>
        <Skeleton class="mt-4 h-14 w-56" />
        <Skeleton class="mt-3 h-4 w-3/4" />
        <Skeleton class="mt-5 h-2 w-full rounded-full" />
        <div class="mt-6 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          <div v-for="i in 4" :key="i" class="grid gap-2">
            <Skeleton class="h-3 w-16" />
            <Skeleton class="h-5 w-24" />
          </div>
        </div>
      </Card>
      <div class="grid content-start gap-4">
        <Card>
          <Skeleton class="h-3 w-28" />
          <Skeleton class="mt-3 h-11 w-full" />
        </Card>
        <Card>
          <Skeleton class="h-3 w-24" />
          <Skeleton class="mt-3 h-8 w-full" />
          <Skeleton class="mt-3 h-8 w-full" />
        </Card>
      </div>
    </div>

    <!-- gráficos -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card>
        <Skeleton class="h-3 w-32" />
        <Skeleton class="mx-auto mt-5 size-40 rounded-full" />
        <div class="mt-5 grid gap-3">
          <Skeleton v-for="i in 3" :key="i" class="h-4 w-full" />
        </div>
      </Card>
      <Card>
        <Skeleton class="h-3 w-24" />
        <div class="mt-5 flex h-44 items-end gap-3">
          <Skeleton v-for="h in [40, 64, 52, 80, 58, 72, 46, 88, 60, 70, 54, 76]" :key="h" class="flex-1" :style="{ height: h + '%' }" />
        </div>
      </Card>
    </div>

    <!-- lista -->
    <Card class="p-0 sm:p-0">
      <div class="flex items-center justify-between p-4 pb-3 sm:px-5">
        <Skeleton class="h-4 w-36" />
        <Skeleton class="h-8 w-48" />
      </div>
      <div v-for="i in 5" :key="i" class="flex items-center gap-3 border-t px-4 py-3 sm:px-5">
        <Skeleton class="size-6 shrink-0 rounded-full" />
        <div class="grid min-w-0 flex-1 gap-2">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-3 w-56 max-w-full" />
        </div>
        <Skeleton class="h-5 w-20" />
      </div>
    </Card>
  </div>
</template>
