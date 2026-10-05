// Valida a migration num Postgres em memória (PGlite), simulando o Supabase:
// schema auth, auth.uid() e os papéis anon/authenticated.
// Uso: npm run test:sql
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../migrations')
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join(';\n')

const db = new PGlite()
let failures = 0
let passed = 0

function ok(cond, label) {
  if (cond) {
    passed++
    console.log('  ok  ', label)
  } else {
    failures++
    console.log('  FALHOU', label)
  }
}
async function throws(fn, label) {
  try {
    await fn()
    ok(false, label + ' (esperava erro)')
  } catch {
    ok(true, label)
  }
}
const as = async (role, uid) => {
  await db.exec('reset role')
  await db.exec(`set role ${role}`)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ''])
}
const q = async (sql, params) => (await db.query(sql, params)).rows
const root = async () => db.exec('reset role')

// --- ambiente simulado do Supabase
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`)

console.log('Aplicando migration...')
await db.exec(migration)
ok(true, 'migration aplicada sem erro')

// --- usuários: o primeiro vira admin
const [{ id: A }] = await q("insert into auth.users (email, raw_user_meta_data) values ('ana@x.com', '{\"display_name\":\"Ana\"}') returning id")
const [{ id: B }] = await q("insert into auth.users (email) values ('beto@x.com') returning id")
const roles = await q('select email, role from public.profiles order by created_at')
ok(roles[0].role === 'admin' && roles[1].role === 'member', 'primeiro usuário é admin, segundo é member')

// --- ensure_month, recorrentes e cartão variável
await as('authenticated', A)
await db.query("insert into month_settings (month, salary) values ('2026-05-01', 5500)")
const [{ id: aluguel }] = await q("insert into recurring_expenses (name, category, kind, amount, due_day, start_month) values ('Aluguel','moradia','fixed',1350,5,'2026-05-01') returning id")
const [{ id: cartao }] = await q("insert into recurring_expenses (name, category, kind, amount, due_day, start_month) values ('Cartão','cartao','variable',1000,20,'2026-05-01') returning id")

await db.query("select ensure_month('2026-05-15')")
let may = await q("select name, amount::float as amount, is_estimate from month_entries where month='2026-05-01' order by name")
ok(may.length === 2, 'maio gerou 2 lançamentos recorrentes')
ok(may.find((e) => e.name === 'Cartão').is_estimate === true, 'cartão nasce como estimativa')

await db.query("select ensure_month('2026-05-01')")
may = await q("select 1 from month_entries where month='2026-05-01'")
ok(may.length === 2, 'ensure_month é idempotente')

await db.query("update month_entries set amount = 1200, is_estimate = false where month='2026-05-01' and recurring_id = $1", [cartao])
await db.query("select ensure_month('2026-06-01')")
let jun = await q("select name, amount::float as amount, is_estimate from month_entries where month='2026-06-01'")
ok(jun.find((e) => e.name === 'Cartão').amount === 1200 && jun.find((e) => e.name === 'Cartão').is_estimate, 'junho estima o cartão pela média (1200) e marca como estimativa')
const sal = await q("select salary::float as s from month_settings where month='2026-06-01'")
ok(sal[0].s === 5500, 'salário do mês novo copia o anterior')

await db.query("update month_entries set amount = 1000, is_estimate = false where month='2026-06-01' and recurring_id = $1", [cartao])
await db.query("select ensure_month('2026-07-01')")
const jul = await q("select amount::float as amount from month_entries where month='2026-07-01' and recurring_id = $1", [cartao])
ok(jul[0].amount === 1100, 'julho estima pela média dos 2 meses confirmados (1100)')

// --- propagar mudança e encerrar
await db.query("update recurring_expenses set amount = 1400 where id = $1", [aluguel])
await db.query("select apply_recurring_change($1, '2026-06-01')", [aluguel])
const alug = await q("select month::text as m, amount::float as amount from month_entries where recurring_id = $1 order by month", [aluguel])
ok(alug[0].amount === 1350 && alug[1].amount === 1400 && alug[2].amount === 1400, 'mudança vale do mês escolhido em diante (maio fica 1350)')

await db.query("select end_recurring($1, '2026-07-01')", [cartao])
const cartaoRows = await q("select month::text as m from month_entries where recurring_id = $1", [cartao])
const cartaoRec = await q("select end_month::text as e from recurring_expenses where id = $1", [cartao])
ok(cartaoRows.length === 2 && cartaoRec[0].e === '2026-06-01', 'encerrar remove meses futuros e fecha o modelo em junho')

// --- cartão de crédito: o marcador passa do modelo recorrente para os meses
const [{ id: netflix }] = await q("insert into recurring_expenses (name, category, kind, amount, due_day, start_month, on_card) values ('Netflix','assinaturas','fixed',45,12,'2026-06-01', true) returning id")
await db.query("select ensure_month('2026-07-01')")
const nfx = await q("select on_card from month_entries where recurring_id = $1 and month = '2026-07-01'", [netflix])
ok(nfx.length === 1 && nfx[0].on_card === true, 'mês novo herda o marcador de cartão da recorrente')
const aluguelCard = await q("select on_card from month_entries where recurring_id = $1 limit 1", [aluguel])
ok(aluguelCard[0].on_card === false, 'recorrente sem marcador continua fora do cartão')
await db.query("update recurring_expenses set on_card = false where id = $1", [netflix])
await db.query("select apply_recurring_change($1, '2026-07-01')", [netflix])
const nfx2 = await q("select on_card from month_entries where recurring_id = $1 and month = '2026-07-01'", [netflix])
ok(nfx2[0].on_card === false, 'mudar o marcador no modelo propaga para os meses seguintes')
await db.query("insert into month_entries (month, name, category, amount, due_day, on_card) values ('2026-07-01', 'Presente', 'outros', 80, 20, true)")
ok((await q("select 1 from month_entries where on_card and name = 'Presente'")).length === 1, 'gasto avulso pode ser marcado como cartão')

// --- metas
await db.query("insert into goals (name, kind, target_amount, target_date) values ('Viagem','trip',9000,'2027-06-01')")
const goals = await q('select count(*)::int as n from goals')
ok(goals[0].n === 1, 'meta criada')

// --- itens do objetivo e rendas extras
const [{ id: goalA }] = await q("select id from goals limit 1")
await db.query("insert into goal_items (goal_id, name, payment, amount) values ($1, 'Passagens', 'cash', 4000)", [goalA])
await db.query(
  "insert into goal_items (goal_id, name, payment, amount, down_payment, installments, installment_amount, first_month, paid_amount, paid_installments) values ($1, 'Hotel', 'installments', 3000, 500, 5, 540, '2026-11-01', 500, 1)",
  [goalA],
)
ok((await q('select 1 from goal_items')).length === 2, 'itens do objetivo criados (à vista e parcelado)')
await throws(() => db.query("insert into goal_items (goal_id, name, payment, amount) values ($1, 'Sem parcelas', 'installments', 100)", [goalA]), 'parcelado exige parcelas, valor e mês')
await throws(() => db.query("insert into goal_items (goal_id, name, payment, amount, paid_amount) values ($1, 'Pago demais', 'cash', 100, 150)", [goalA]), 'pago à vista não passa do valor')
await throws(() => db.query("insert into goal_items (goal_id, name, payment, amount, installments, installment_amount, first_month, paid_installments) values ($1, 'Parcelas demais', 'installments', 100, 3, 40, '2026-11-01', 4)", [goalA]), 'parcelas pagas não passam do total')
await throws(() => db.query("update goals set my_share = 1.5"), 'minha parte vai de 0 a 100%')
await db.query("update goals set my_share = 0.5")
await db.query("insert into month_incomes (month, description, amount) values ('2026-05-01', 'Pix da Niva', 300)")
await throws(() => db.query("insert into month_incomes (month, description, amount) values ('2026-05-15', 'Dia 15', 10)"), 'renda extra exige mês no dia 1')
await throws(() => db.query("insert into month_incomes (month, description, amount) values ('2026-05-01', 'Zero', 0)"), 'renda extra precisa ser positiva')

// --- isolamento entre usuários
await as('authenticated', B)
ok((await q('select 1 from goal_items')).length === 0, 'outro usuário não vê itens de objetivo')
ok((await q('select 1 from month_incomes')).length === 0, 'outro usuário não vê rendas extras')
await throws(() => db.query("insert into goal_items (goal_id, name, payment, amount) values ($1, 'Intruso', 'cash', 10)", [goalA]), 'não dá para pendurar item em objetivo alheio')

ok((await q('select 1 from month_entries')).length === 0, 'outro usuário não vê lançamentos')
ok((await q('select 1 from goals')).length === 0, 'outro usuário não vê metas')
ok((await q('select 1 from profiles')).length === 1, 'member vê só o próprio perfil')
ok((await q('select 1 from invites')).length === 0, 'member não vê convites')
await throws(() => db.query("insert into invites (token_hash) values ('abc')"), 'member não cria convite')
ok((await q("update month_entries set paid = true returning 1")).length === 0, 'update em dados alheios não afeta nenhuma linha')

// --- perfil: não dá para virar admin
await as('authenticated', B)
await throws(() => db.query("update profiles set role = 'admin' where id = $1", [B]), 'member não promove a si mesmo a admin')
await as('authenticated', A)
await throws(() => db.query("update profiles set role = 'member' where id = $1", [A]), 'nem o admin altera papel pela API')
ok((await q('select 1 from profiles')).length === 2, 'admin vê todos os perfis')

// --- pedido de acesso (público) e convites
await as('anon')
await db.query("select request_access('Carla', 'carla@x.com', 'Oi!')")
await db.query("select request_access('Carla', 'CARLA@x.com', 'de novo')")
await db.query("select request_access('Beto', 'beto@x.com', 'já tenho conta')")
await throws(() => db.query("select request_access('', 'x@y.com')"), 'nome vazio é recusado')
await throws(() => db.query("select request_access('Zé', 'sem-arroba')"), 'e-mail inválido é recusado')
await throws(() => db.query('select * from access_requests'), 'anon não lê pedidos')
await throws(() => db.query('select * from month_entries'), 'anon não lê dados')
await throws(() => db.query('select * from goal_items'), 'anon não lê itens de objetivo')
await throws(() => db.query('select * from month_incomes'), 'anon não lê rendas extras')
await throws(() => db.query("select ensure_month('2026-05-01')"), 'anon não chama ensure_month')
const nf = await q("select check_invite('nao-existe') as r")
ok(nf[0].r.valid === false && nf[0].r.reason === 'not_found', 'convite inexistente é inválido')

await as('authenticated', A)
const reqs = await q('select email, status from access_requests')
ok(reqs.length === 1 && reqs[0].email === 'carla@x.com', 'pedido duplicado e de quem já tem conta não entram')
const [{ id: inv }] = await q("insert into invites (token_hash, note, email) values ('h1', 'Carla', 'carla@x.com') returning id")
await db.query("update access_requests set status='approved', invite_id=$1, decided_at=now()", [inv])

await as('anon')
const okInv = await q("select check_invite('h1') as r")
ok(okInv[0].r.valid === true && okInv[0].r.note === 'Carla', 'convite válido é reconhecido')

await root()
await db.query("update invites set expires_at = now() - interval '1 day' where token_hash='h1'")
await as('anon')
const exp = await q("select check_invite('h1') as r")
ok(exp[0].r.reason === 'expired', 'convite vencido é recusado')

console.log(`\n${passed} verificações ok, ${failures} falhas`)
process.exit(failures ? 1 : 0)
