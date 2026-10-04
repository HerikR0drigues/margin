// Cria a conta de quem abriu um link de convite válido.
// Roda com a service role (Deno). O cadastro público fica desligado no Auth.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { token?: string; name?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const token = String(body.token ?? '')
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  if (!token || token.length < 20) return json({ error: 'invalid_invite' }, 400)
  if (!name || name.length > 80) return json({ error: 'invalid_name' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
    return json({ error: 'invalid_email' }, 400)
  }
  if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const tokenHash = await sha256Hex(token)

  // Reserva o convite de forma atômica: só uma pessoa consegue usar.
  const { data: invite, error: claimError } = await admin
    .from('invites')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id, email')
    .maybeSingle()

  if (claimError || !invite) return json({ error: 'invalid_invite' }, 400)

  if (invite.email && invite.email.toLowerCase() !== email) {
    await admin.from('invites').update({ used_at: null }).eq('id', invite.id)
    return json({ error: 'email_mismatch' }, 400)
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  })

  if (createError || !created.user) {
    await admin.from('invites').update({ used_at: null }).eq('id', invite.id)
    const exists = /already|registered|exists/i.test(createError?.message ?? '')
    return json({ error: exists ? 'email_taken' : 'create_failed' }, exists ? 409 : 500)
  }

  await admin.from('invites').update({ used_by: created.user.id }).eq('id', invite.id)
  await admin
    .from('access_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .ilike('email', email)
    .eq('status', 'pending')

  return json({ ok: true })
})
