<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from '@lucide/vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import InviteLinkDialog from '@/components/InviteLinkDialog.vue'
import type { Invite } from '@/lib/types'
import { useAdmin } from '@/stores/admin'

const admin = useAdmin()
onMounted(() => void admin.load())

const tab = ref('requests')
const pending = computed(() => admin.requests.filter((r) => r.status === 'pending'))
const decided = computed(() => admin.requests.filter((r) => r.status !== 'pending'))
const tabs = computed(() => [
  { value: 'requests', label: `Pedidos${pending.value.length ? ` (${pending.value.length})` : ''}` },
  { value: 'invites', label: 'Convites' },
  { value: 'users', label: 'Usuários' },
])

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
function inviteState(i: Invite) {
  if (i.used_at) return 'usado'
  if (i.revoked_at) return 'cancelado'
  if (new Date(i.expires_at) < new Date()) return 'expirado'
  return 'ativo'
}

const linkOpen = ref(false)
const link = ref('')
const linkWho = ref('')

const createOpen = ref(false)
const note = ref('')
const email = ref('')
const days = ref('7')
const busy = ref(false)
const err = ref('')
function openCreate() {
  note.value = ''
  email.value = ''
  days.value = '7'
  err.value = ''
  createOpen.value = true
}
async function create() {
  err.value = ''
  if (email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) return void (err.value = 'E-mail inválido.')
  busy.value = true
  const res = await admin.createInvite({ note: note.value.trim(), email: email.value.trim().toLowerCase(), days: Number(days.value) })
  busy.value = false
  if (!res) return
  createOpen.value = false
  link.value = res.link
  linkWho.value = note.value.trim() || email.value.trim()
  linkOpen.value = true
}
async function approve(i: number) {
  const req = pending.value[i]!
  const l = await admin.approveRequest(req)
  if (!l) return
  link.value = l
  linkWho.value = req.name
  linkOpen.value = true
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Administração</h1>
        <p class="mt-1 text-sm text-muted-foreground">Quem pode entrar: pedidos, convites e usuários.</p>
      </div>
      <Button @click="openCreate"><Plus /> Gerar convite</Button>
    </div>

    <Segmented v-model="tab" :options="tabs" class="w-fit" />

    <Card v-if="tab === 'requests'" class="p-0 sm:p-0">
      <ul>
        <li v-for="(r, i) in pending" :key="r.id" class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5">
          <div class="min-w-0">
            <div class="font-medium">{{ r.name }}</div>
            <div class="truncate text-sm text-muted-foreground">{{ r.email }} · {{ fmt(r.created_at) }}</div>
            <p v-if="r.message" class="mt-1 text-sm">{{ r.message }}</p>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="admin.rejectRequest(r)">Recusar</Button>
            <Button size="sm" @click="approve(i)">Aprovar e gerar link</Button>
          </div>
        </li>
      </ul>
      <p v-if="!pending.length" class="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum pedido pendente.</p>
      <div v-if="decided.length" class="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Já decididos: {{ decided.map((r) => `${r.name} (${r.status === 'approved' ? 'aprovado' : 'recusado'})`).join(', ') }}
      </div>
    </Card>

    <Card v-else-if="tab === 'invites'" class="p-0 sm:p-0">
      <ul>
        <li v-for="i in admin.invites" :key="i.id" class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5">
          <div class="min-w-0">
            <div class="truncate font-medium">{{ i.note || i.email || 'Convite sem nome' }}</div>
            <div class="text-sm text-muted-foreground">
              criado {{ fmt(i.created_at) }} · expira {{ fmt(i.expires_at) }}<span v-if="i.email"> · {{ i.email }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="inviteState(i) === 'ativo' ? 'primary' : 'outline'">{{ inviteState(i) }}</Badge>
            <Button v-if="inviteState(i) === 'ativo'" variant="outline" size="sm" @click="admin.revokeInvite(i.id)">Cancelar</Button>
          </div>
        </li>
      </ul>
      <p v-if="!admin.invites.length" class="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum convite gerado.</p>
    </Card>

    <Card v-else class="p-0 sm:p-0">
      <ul>
        <li v-for="u in admin.users" :key="u.id" class="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5">
          <div class="min-w-0">
            <div class="truncate font-medium">{{ u.display_name || u.email }}</div>
            <div class="truncate text-sm text-muted-foreground">{{ u.email }} · desde {{ fmt(u.created_at) }}</div>
          </div>
          <Badge :variant="u.role === 'admin' ? 'primary' : 'outline'">{{ u.role === 'admin' ? 'admin' : 'membro' }}</Badge>
        </li>
      </ul>
    </Card>

    <Dialog v-model:open="createOpen" title="Gerar convite" description="Você recebe um link para enviar. Ele vale uma vez só.">
      <form class="grid gap-3.5" novalidate @submit.prevent="create">
        <div class="grid gap-1.5">
          <Label for="c-note">Para quem (opcional)</Label>
          <Input id="c-note" v-model="note" type="text" maxlength="80" placeholder="Nome da pessoa" />
        </div>
        <div class="grid gap-1.5">
          <Label for="c-email">Travar em um e-mail (opcional)</Label>
          <Input id="c-email" v-model="email" type="email" maxlength="160" />
        </div>
        <div class="grid gap-1.5">
          <Label for="c-days">Validade</Label>
          <Select id="c-days" v-model="days">
            <option value="1">1 dia</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </Select>
        </div>
        <p v-if="err" class="text-sm text-destructive" role="alert">{{ err }}</p>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" @click="createOpen = false">Cancelar</Button>
          <Button type="submit" :disabled="busy">Gerar link</Button>
        </div>
      </form>
    </Dialog>
    <InviteLinkDialog v-model:open="linkOpen" :link="link" :who="linkWho" />
  </div>
</template>
