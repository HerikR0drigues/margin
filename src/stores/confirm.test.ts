import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConfirm } from './confirm'

describe('modal de confirmação', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resolve true quando o usuário confirma e fecha o modal', async () => {
    const c = useConfirm()
    const p = c.ask({ title: 'Excluir?' })
    expect(c.open).toBe(true)
    c.answer(true)
    await expect(p).resolves.toBe(true)
    expect(c.open).toBe(false)
  })

  it('resolve false quando o usuário cancela', async () => {
    const c = useConfirm()
    const p = c.ask({ title: 'Excluir?', danger: true })
    c.answer(false)
    await expect(p).resolves.toBe(false)
  })

  it('uma pergunta nova cancela a anterior que ainda estava aberta', async () => {
    const c = useConfirm()
    const first = c.ask({ title: 'Primeira' })
    const second = c.ask({ title: 'Segunda' })
    await expect(first).resolves.toBe(false)
    expect(c.options.title).toBe('Segunda')
    c.answer(true)
    await expect(second).resolves.toBe(true)
  })
})
