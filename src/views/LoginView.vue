<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import AccessRequestDialog from '@/components/AccessRequestDialog.vue'
import { useAuth } from '@/stores/auth'
import { errorMessage } from '@/stores/toast'

const auth = useAuth()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const requestOpen = ref(false)

async function submit() {
  error.value = ''
  if (!email.value.trim() || !password.value) return void (error.value = 'Preencha e-mail e senha.')
  busy.value = true
  try {
    await auth.signIn(email.value.trim(), password.value)
    await router.replace('/')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex items-center gap-2.5">
        <span class="grid size-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">C</span>
        <span class="text-lg font-semibold tracking-tight">Contas do Mês</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p class="mt-1 text-sm text-muted-foreground">Seus gastos, metas e o que sobra em cada mês.</p>

      <form class="mt-6 grid gap-4" novalidate @submit.prevent="submit">
        <div class="grid gap-1.5">
          <Label for="l-email">E-mail</Label>
          <Input id="l-email" v-model="email" type="email" autocomplete="email" class="h-10" />
        </div>
        <div class="grid gap-1.5">
          <Label for="l-pass">Senha</Label>
          <Input id="l-pass" v-model="password" type="password" autocomplete="current-password" class="h-10" />
        </div>
        <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
        <Button type="submit" class="h-10" :disabled="busy">Entrar</Button>
      </form>

      <p class="mt-6 text-sm text-muted-foreground">
        Ainda não tem acesso?
        <button type="button" class="font-medium text-primary-text underline-offset-4 hover:underline" @click="requestOpen = true">
          Pedir acesso
        </button>
      </p>
    </div>
    <AccessRequestDialog v-model:open="requestOpen" />
  </div>
</template>
