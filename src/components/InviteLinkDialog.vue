<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Copy } from '@lucide/vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{ link: string; who?: string }>()
const open = defineModel<boolean>('open', { default: false })
const copied = ref(false)
const input = ref<HTMLInputElement | null>(null)

watch(open, (v) => {
  if (v) copied.value = false
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.link)
    copied.value = true
  } catch {
    input.value?.select()
  }
}
const whatsapp = () =>
  `https://wa.me/?text=${encodeURIComponent(`Você foi convidado para o Margin. Crie sua conta aqui: ${props.link}`)}`
</script>

<template>
  <Dialog
    v-model:open="open"
    title="Link de convite"
    :description="`${who ? 'Para ' + who + '. ' : ''}Este link aparece só agora e vale uma única vez. Copie e envie.`"
  >
    <div class="grid gap-3">
      <input
        ref="input"
        :value="link"
        readonly
        aria-label="Link de convite"
        class="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <div class="flex flex-wrap justify-end gap-2">
        <a :href="whatsapp()" target="_blank" rel="noopener" class="inline-flex h-9 items-center rounded-lg border border-input px-3.5 text-sm font-medium hover:bg-muted">
          Enviar por WhatsApp
        </a>
        <Button @click="copy"><component :is="copied ? Check : Copy" /> {{ copied ? 'Copiado' : 'Copiar link' }}</Button>
      </div>
    </div>
  </Dialog>
</template>
