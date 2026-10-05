<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { hasSupabaseEnv } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import SetupMissing from '@/components/SetupMissing.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Toaster from '@/components/ui/Toaster.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

// Se a sessão acabar (ou o usuário sair em outra aba), volta para o login.
watch(
  () => auth.isLoggedIn,
  (logged) => {
    if (!logged && route.meta.auth) void router.replace('/login')
  },
)
</script>

<template>
  <SetupMissing v-if="!hasSupabaseEnv" />
  <!-- sessão ainda carregando: esqueleto da casca do app em vez de tela em branco -->
  <div v-else-if="!auth.ready" class="flex min-h-dvh" role="status" aria-busy="true" aria-label="Carregando">
    <aside class="hidden w-56 shrink-0 gap-3 border-r p-4 md:grid md:content-start">
      <Skeleton class="h-7 w-24" />
      <Skeleton v-for="i in 4" :key="i" class="h-8 w-full" />
    </aside>
    <main class="grid flex-1 content-start gap-4 p-4 sm:p-6">
      <Skeleton class="h-8 w-56" />
      <Skeleton class="h-48 w-full rounded-2xl" />
      <Skeleton class="h-64 w-full rounded-2xl" />
    </main>
  </div>
  <template v-else>
    <AppShell v-if="route.meta.shell">
      <RouterView />
    </AppShell>
    <RouterView v-else />
  </template>
  <Toaster />
</template>
