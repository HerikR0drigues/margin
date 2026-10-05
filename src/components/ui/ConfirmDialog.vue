<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useConfirm } from '@/stores/confirm'

const confirm = useConfirm()

// Fechar pelo X, pelo Esc ou clicando fora conta como "não".
function onOpen(v: boolean) {
  if (!v && confirm.open) confirm.answer(false)
}
</script>

<template>
  <Dialog :open="confirm.open" :title="confirm.options.title" :description="confirm.options.description" @update:open="onOpen">
    <div class="flex justify-end gap-2">
      <Button variant="ghost" @click="confirm.answer(false)">Cancelar</Button>
      <Button :variant="confirm.options.danger ? 'destructive' : 'default'" @click="confirm.answer(true)">
        {{ confirm.options.confirmLabel ?? 'Confirmar' }}
      </Button>
    </div>
  </Dialog>
</template>
