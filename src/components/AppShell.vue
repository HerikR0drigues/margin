<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, LogOut, Repeat, Shield, Target } from '@lucide/vue'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

interface NavItem {
  to: string
  label: string
  icon: Component
}
const items = computed<NavItem[]>(() => {
  const list: NavItem[] = [
    { to: '/', label: 'Mês', icon: LayoutDashboard },
    { to: '/recorrentes', label: 'Recorrentes', icon: Repeat },
    { to: '/planejamento', label: 'Planejamento', icon: Target },
  ]
  if (auth.isAdmin) list.push({ to: '/admin', label: 'Admin', icon: Shield })
  return list
})
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

async function logout() {
  await auth.signOut()
  await router.replace('/login')
}
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[224px_minmax(0,1fr)]">
    <aside class="sticky top-0 hidden h-dvh flex-col border-r px-3 py-5 md:flex">
      <div class="px-2 pb-6">
        <div class="flex items-center gap-2">
          <span class="grid size-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">C</span>
          <span class="text-[15px] font-semibold tracking-tight">Margin</span>
        </div>
      </div>
      <nav class="flex flex-col gap-0.5" aria-label="Principal">
        <RouterLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :class="
            cn(
              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive(item.to) && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            )
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="mt-auto border-t px-2 pt-4">
        <div class="truncate text-sm font-medium">{{ auth.displayName }}</div>
        <div class="truncate text-xs text-muted-foreground">{{ auth.profile?.email }}</div>
        <button
          type="button"
          class="mt-3 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="logout"
        >
          <LogOut class="size-4" /> Sair
        </button>
      </div>
    </aside>

    <div class="min-w-0">
      <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
        <div class="flex items-center gap-2">
          <span class="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">C</span>
          <span class="text-sm font-semibold tracking-tight">Margin</span>
        </div>
        <button type="button" class="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Sair" @click="logout">
          <LogOut class="size-4" />
        </button>
      </header>
      <main class="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
        <slot />
      </main>
    </div>

    <nav class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Principal">
      <ul class="mx-auto flex max-w-md">
        <li v-for="item in items" :key="item.to" class="flex-1">
          <RouterLink
            :to="item.to"
            :class="
              cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground',
                isActive(item.to) && 'text-accent-foreground',
              )
            "
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <component :is="item.icon" class="size-5" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
