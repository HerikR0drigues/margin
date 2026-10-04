import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** Largura atual de um elemento, atualizada quando ele muda de tamanho. */
export function useElementWidth(el: Ref<HTMLElement | null>) {
  const width = ref(0)
  let observer: ResizeObserver | null = null

  onMounted(() => {
    const node = el.value
    if (!node) return
    width.value = Math.floor(node.clientWidth)
    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) width.value = Math.floor(entry.contentRect.width)
    })
    observer.observe(node)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return width
}
