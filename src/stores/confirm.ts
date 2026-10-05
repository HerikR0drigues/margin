import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  /** texto do botão de confirmar (padrão: "Confirmar") */
  confirmLabel?: string
  /** ação destrutiva: o botão de confirmar fica vermelho */
  danger?: boolean
}

/**
 * Modal de confirmação único para o app inteiro.
 * Uso: `if (!(await confirm.ask({ title: 'Excluir?' }))) return`
 */
export const useConfirm = defineStore('confirm', () => {
  const open = ref(false)
  const options = ref<ConfirmOptions>({ title: '' })
  let resolver: ((ok: boolean) => void) | null = null

  function ask(opts: ConfirmOptions): Promise<boolean> {
    // se já havia uma pergunta aberta, ela é cancelada
    resolver?.(false)
    options.value = opts
    open.value = true
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function answer(ok: boolean) {
    open.value = false
    resolver?.(ok)
    resolver = null
  }

  return { open, options, ask, answer }
})
