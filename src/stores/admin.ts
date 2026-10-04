import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { generateToken, inviteLink, sha256Hex } from '@/lib/token'
import type { AccessRequest, Invite, Profile } from '@/lib/types'
import { useToast } from './toast'

export const useAdmin = defineStore('admin', () => {
  const toast = useToast()
  const invites = ref<Invite[]>([])
  const requests = ref<AccessRequest[]>([])
  const users = ref<Profile[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const [i, r, u] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at'),
    ])
    loading.value = false
    if (i.error) return toast.error(i.error)
    if (r.error) return toast.error(r.error)
    if (u.error) return toast.error(u.error)
    invites.value = (i.data ?? []) as Invite[]
    requests.value = (r.data ?? []) as AccessRequest[]
    users.value = (u.data ?? []) as Profile[]
  }

  /** Cria o convite e devolve o link. O token só existe aqui: o banco guarda o hash. */
  async function createInvite(opts: { note: string; email?: string; days: number }): Promise<{ id: string; link: string } | null> {
    const token = generateToken()
    const token_hash = await sha256Hex(token)
    const expires_at = new Date(Date.now() + opts.days * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('invites')
      .insert({ token_hash, note: opts.note, email: opts.email || null, expires_at })
      .select('id')
      .single()
    if (error) {
      toast.error(error)
      return null
    }
    await load()
    return { id: data.id as string, link: inviteLink(token) }
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast.error(error)
    await load()
    toast.ok('Convite cancelado')
  }

  async function approveRequest(req: AccessRequest): Promise<string | null> {
    const created = await createInvite({ note: req.name, email: req.email, days: 7 })
    if (!created) return null
    const { error } = await supabase
      .from('access_requests')
      .update({ status: 'approved', invite_id: created.id, decided_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) {
      toast.error(error)
      return null
    }
    await load()
    return created.link
  }

  async function rejectRequest(req: AccessRequest) {
    const { error } = await supabase
      .from('access_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', req.id)
    if (error) return toast.error(error)
    await load()
    toast.ok('Pedido recusado')
  }

  return { invites, requests, users, loading, load, createInvite, revokeInvite, approveRequest, rejectRequest }
})
