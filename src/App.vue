<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { hasSupabaseEnv } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import SetupMissing from '@/components/SetupMissing.vue'
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
  <template v-else>
    <AppShell v-if="route.meta.shell">
      <RouterView />
    </AppShell>
    <RouterView v-else />
  </template>
  <Toaster />
</template>
