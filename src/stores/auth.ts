import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export const useAuth = defineStore('auth', () => {
  const session = shallowRef<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)

  const isLoggedIn = computed(() => session.value !== null)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const displayName = computed(
    () => profile.value?.display_name || profile.value?.email?.split('@')[0] || '',
  )

  async function loadProfile() {
    if (!session.value) {
      profile.value = null
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.value.user.id).maybeSingle()
    profile.value = (data as Profile | null) ?? null
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await loadProfile()
    ready.value = true
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
      // adia a chamada: não se faz await de queries dentro do callback do Auth
      setTimeout(() => void loadProfile(), 0)
    })
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    await loadProfile()
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  return { session, profile, ready, isLoggedIn, isAdmin, displayName, init, signIn, signOut, loadProfile }
})

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'E-mail ainda não confirmado.'
  return message
}
