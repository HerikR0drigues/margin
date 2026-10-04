-- Contas do Mês: schema inicial
-- Acesso só por convite. Cada usuário enxerga apenas os próprios dados (RLS).
-- O primeiro usuário criado vira admin automaticamente.

------------------------------------------------------------------------------
-- Tipos
------------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');
-- fixed: mesmo valor todo mês (aluguel). variable: varia (cartão, luz).
create type public.expense_kind as enum ('fixed', 'variable');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.goal_kind as enum ('trip', 'car', 'reserve', 'other');

------------------------------------------------------------------------------
-- Perfis
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case when exists (select 1 from public.profiles) then 'member'::public.app_role
         else 'admin'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- Convites e pedidos de acesso
------------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  note text not null default '' check (char_length(note) <= 120),
  email text,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 160),
  message text not null default '' check (char_length(message) <= 500),
  status public.request_status not null default 'pending',
  invite_id uuid references public.invites (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- um pedido pendente por e-mail
create unique index access_requests_pending_email
  on public.access_requests (lower(email)) where status = 'pending';

-- Pedido público (sem login). Não revela se o e-mail já tem conta.
create or replace function public.request_access(p_name text, p_email text, p_message text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'invalid_name';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then
    raise exception 'invalid_email';
  end if;
  if (select count(*) from public.access_requests where status = 'pending') >= 100 then
    raise exception 'too_many_requests';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    return;
  end if;
  insert into public.access_requests (name, email, message)
  values (v_name, v_email, left(trim(coalesce(p_message, '')), 500))
  on conflict do nothing;
end;
$$;

-- Verifica um convite pelo hash do token (a tela de convite usa isto).
create or replace function public.check_invite(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  i public.invites;
begin
  select * into i from public.invites where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if i.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'revoked');
  end if;
  if i.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;
  if i.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  return jsonb_build_object('valid', true, 'note', i.note, 'email', i.email);
end;
$$;

------------------------------------------------------------------------------
-- Dados financeiros (todos por usuário)
------------------------------------------------------------------------------
create table public.month_settings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  salary numeric(12, 2) not null default 0 check (salary >= 0),
  primary key (user_id, month)
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  category text not null,
  kind public.expense_kind not null default 'fixed',
  amount numeric(12, 2) not null check (amount >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  start_month date not null check (start_month = date_trunc('month', start_month)::date),
  end_month date check (end_month is null or end_month = date_trunc('month', end_month)::date),
  created_at timestamptz not null default now()
);

create table public.month_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  recurring_id uuid references public.recurring_expenses (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_day smallint not null check (due_day between 1 and 31),
  paid boolean not null default false,
  is_estimate boolean not null default false,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index month_entries_recurring_month
  on public.month_entries (recurring_id, month) where recurring_id is not null;
create index month_entries_user_month on public.month_entries (user_id, month);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind public.goal_kind not null default 'other',
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  target_date date not null,
  -- rendimento mensal da reserva como fração (0.008 = 0,8% a.m.)
  yield_pm numeric(6, 4) not null default 0 check (yield_pm >= 0 and yield_pm < 0.1),
  -- financiamento (carro): entrada, parcelas e juros mensais (fração)
  financing boolean not null default false,
  down_payment numeric(12, 2) not null default 0 check (down_payment >= 0),
  installments smallint check (installments is null or installments between 1 and 120),
  interest_pm numeric(6, 4) not null default 0 check (interest_pm >= 0 and interest_pm < 0.2),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (goal_id, month)
);

------------------------------------------------------------------------------
-- Funções de negócio
------------------------------------------------------------------------------

-- Cria o que falta no mês: salário (copia o último) e as despesas recorrentes.
-- Despesas variáveis (cartão) entram com a média dos últimos 3 meses confirmados
-- e ficam marcadas como estimativa até você informar o valor real.
create or replace function public.ensure_month(p_month date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.month_settings (user_id, month, salary)
  select auth.uid(), v_month,
         coalesce((select s.salary from public.month_settings s
                    where s.user_id = auth.uid() and s.month < v_month
                    order by s.month desc limit 1), 0)
  on conflict do nothing;

  insert into public.month_entries (user_id, month, recurring_id, name, category, amount, due_day, is_estimate)
  select r.user_id, v_month, r.id, r.name, r.category,
         case when r.kind = 'variable' then
           coalesce((select round(avg(x.amount), 2)
                       from (select e.amount from public.month_entries e
                              where e.recurring_id = r.id and e.month < v_month
                                and e.is_estimate = false and e.skipped = false
                              order by e.month desc limit 3) x), r.amount)
         else r.amount end,
         r.due_day,
         r.kind = 'variable'
    from public.recurring_expenses r
   where r.user_id = auth.uid()
     and r.start_month <= v_month
     and (r.end_month is null or r.end_month >= v_month)
  on conflict do nothing;
end;
$$;

-- Propaga mudanças do modelo recorrente para os meses de p_from em diante.
-- Valor só muda nas fixas ainda não pagas; as variáveis mantêm o valor do mês.
create or replace function public.apply_recurring_change(p_id uuid, p_from date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  r public.recurring_expenses;
begin
  select * into r from public.recurring_expenses where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  update public.month_entries e
     set name = r.name,
         category = r.category,
         due_day = r.due_day,
         amount = case when r.kind = 'fixed' and e.paid = false then r.amount else e.amount end
   where e.recurring_id = r.id and e.month >= v_from;
end;
$$;

-- Encerra uma recorrente a partir de um mês: remove os meses futuros e fecha o modelo.
create or replace function public.end_recurring(p_id uuid, p_from date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  r public.recurring_expenses;
begin
  select * into r from public.recurring_expenses where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  delete from public.month_entries where recurring_id = r.id and month >= v_from and paid = false;
  update public.recurring_expenses
     set end_month = (v_from - interval '1 month')::date
   where id = r.id;
  -- se o fim cair antes do início, o modelo nunca valeu: remove
  delete from public.recurring_expenses where id = r.id and end_month < start_month;
end;
$$;

------------------------------------------------------------------------------
-- Segurança (RLS)
------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.access_requests enable row level security;
alter table public.month_settings enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.month_entries enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy invites_admin on public.invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy access_requests_admin on public.access_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy own_rows on public.month_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.recurring_expenses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.month_entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.goals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.goal_contributions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

------------------------------------------------------------------------------
-- Permissões
------------------------------------------------------------------------------
-- Tabelas privadas: nada para anon. Perfil: só pode editar o nome (não o papel).
revoke all on public.profiles, public.invites, public.access_requests,
  public.month_settings, public.recurring_expenses, public.month_entries,
  public.goals, public.goal_contributions from anon;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_month(date) from public, anon;
revoke execute on function public.apply_recurring_change(uuid, date) from public, anon;
revoke execute on function public.end_recurring(uuid, date) from public, anon;
grant execute on function public.ensure_month(date) to authenticated;
grant execute on function public.apply_recurring_change(uuid, date) to authenticated;
grant execute on function public.end_recurring(uuid, date) to authenticated;

revoke execute on function public.request_access(text, text, text) from public;
revoke execute on function public.check_invite(text) from public;
grant execute on function public.request_access(text, text, text) to anon, authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;
