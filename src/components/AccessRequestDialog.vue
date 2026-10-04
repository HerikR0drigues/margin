<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/stores/toast'

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const name = ref('')
const email = ref('')
const message = ref('')
const error = ref('')
const busy = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    email.value = ''
    message.value = ''
    error.value = ''
  }
})

async function submit() {
  error.value = ''
  if (!name.value.trim()) return void (error.value = 'Diga seu nome.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) return void (error.value = 'Digite um e-mail válido.')
  busy.value = true
  const { error: rpcError } = await supabase.rpc('request_access', {
    p_name: name.value.trim(),
    p_email: email.value.trim(),
    p_message: message.value.trim(),
  })
  busy.value = false
  if (rpcError) {
    error.value = /too_many/.test(rpcError.message)
      ? 'Há muitos pedidos na fila agora. Tente de novo mais tarde.'
      : 'Não foi possível enviar o pedido. Confira os dados e tente de novo.'
    return
  }
  toast.ok('Pedido enviado. Quando for liberado, você recebe um link de convite.')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open" title="Pedir acesso" description="O acesso é por convite. Seu pedido chega ao administrador, que envia um link se liberar.">
    <form class="grid gap-3.5" novalidate @submit.prevent="submit">
      <div class="grid gap-1.5">
        <Label for="a-name">Nome</Label>
        <Input id="a-name" v-model="name" type="text" maxlength="80" autocomplete="name" />
      </div>
      <div class="grid gap-1.5">
        <Label for="a-email">E-mail</Label>
        <Input id="a-email" v-model="email" type="email" maxlength="160" autocomplete="email" />
      </div>
      <div class="grid gap-1.5">
        <Label for="a-msg">Mensagem (opcional)</Label>
        <Input id="a-msg" v-model="message" type="text" maxlength="500" placeholder="Quem é você ou por que quer acesso" />
      </div>
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button type="submit" :disabled="busy">Enviar pedido</Button>
      </div>
    </form>
  </Dialog>
</template>
