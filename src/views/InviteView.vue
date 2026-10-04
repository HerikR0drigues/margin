<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { supabase } from '@/lib/supabase'
import { sha256Hex } from '@/lib/token'
import { useAuth } from '@/stores/auth'
import { errorMessage } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const token = String(route.params.token ?? '')
const state = ref<'loading' | 'ok' | 'invalid'>('loading')
const invalidReason = ref('')
const name = ref('')
const email = ref('')
const lockedEmail = ref(false)
const password = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)

const reasons: Record<string, string> = {
  not_found: 'Este link de convite não existe.',
  expired: 'Este convite expirou. Peça um novo ao administrador.',
  used: 'Este convite já foi usado.',
  revoked: 'Este convite foi cancelado.',
}
const codes: Record<string, string> = {
  invalid_invite: 'Este convite não é mais válido.',
  email_mismatch: 'Este convite foi feito para outro e-mail.',
  email_taken: 'Já existe uma conta com este e-mail.',
  weak_password: 'A senha precisa ter de 8 a 72 caracteres.',
  invalid_email: 'Digite um e-mail válido.',
  invalid_name: 'Digite seu nome.',
  create_failed: 'Não foi possível criar a conta. Tente de novo.',
}

onMounted(async () => {
  try {
    const hash = await sha256Hex(token)
    const { data, error: rpcError } = await supabase.rpc('check_invite', { p_token_hash: hash })
    if (rpcError) throw rpcError
    if (data?.valid) {
      state.value = 'ok'
      if (data.note) name.value = String(data.note)
      if (data.email) {
        email.value = String(data.email)
        lockedEmail.value = true
      }
    } else {
      invalidReason.value = reasons[String(data?.reason)] ?? reasons.not_found!
      state.value = 'invalid'
    }
  } catch {
    invalidReason.value = 'Não foi possível verificar o convite agora. Tente de novo em instantes.'
    state.value = 'invalid'
  }
})

async function readFunctionError(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string }
      if (body.error && codes[body.error]) return codes[body.error]!
    } catch {
      /* cai na mensagem genérica */
    }
  }
  return codes.create_failed!
}

async function submit() {
  error.value = ''
  if (!name.value.trim()) return void (error.value = codes.invalid_name!)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) return void (error.value = codes.invalid_email!)
  if (password.value.length < 8) return void (error.value = codes.weak_password!)
  if (password.value !== confirm.value) return void (error.value = 'As senhas não são iguais.')
  busy.value = true
  try {
    const { error: fnError } = await supabase.functions.invoke('accept-invite', {
      body: { token, name: name.value.trim(), email: email.value.trim(), password: password.value },
    })
    if (fnError) {
      error.value = await readFunctionError(fnError)
      return
    }
    await auth.signIn(email.value.trim().toLowerCase(), password.value)
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

      <p v-if="state === 'loading'" class="text-sm text-muted-foreground">Verificando o convite…</p>

      <template v-else-if="state === 'invalid'">
        <h1 class="text-2xl font-semibold tracking-tight">Convite indisponível</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ invalidReason }}</p>
        <RouterLink to="/login" class="mt-6 inline-block text-sm font-medium text-primary-text underline-offset-4 hover:underline">
          Ir para o login
        </RouterLink>
      </template>

      <template v-else>
        <h1 class="text-2xl font-semibold tracking-tight">Criar sua conta</h1>
        <p class="mt-1 text-sm text-muted-foreground">Você foi convidado. Escolha uma senha para entrar.</p>
        <form class="mt-6 grid gap-4" novalidate @submit.prevent="submit">
          <div class="grid gap-1.5">
            <Label for="i-name">Nome</Label>
            <Input id="i-name" v-model="name" type="text" maxlength="80" autocomplete="name" class="h-10" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-email">E-mail</Label>
            <Input id="i-email" v-model="email" type="email" autocomplete="email" :readonly="lockedEmail" class="h-10" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-pass">Senha (mínimo 8 caracteres)</Label>
            <Input id="i-pass" v-model="password" type="password" autocomplete="new-password" class="h-10" />
          </div>
          <div class="grid gap-1.5">
            <Label for="i-conf">Repita a senha</Label>
            <Input id="i-conf" v-model="confirm" type="password" autocomplete="new-password" class="h-10" />
          </div>
          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
          <Button type="submit" class="h-10" :disabled="busy">Criar conta e entrar</Button>
        </form>
      </template>
    </div>
  </div>
</template>
