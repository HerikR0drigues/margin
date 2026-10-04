-- Rendas extras do mês e itens de objetivo (à vista / parcelado, divisão com outra pessoa).

------------------------------------------------------------------------------
-- Rendas extras: Pix recebido, bônus, venda... soma ao salário do mês
------------------------------------------------------------------------------
create table public.month_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  description text not null check (char_length(description) between 1 and 60),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index month_incomes_user_month on public.month_incomes (user_id, month);

------------------------------------------------------------------------------
-- Objetivos: parte do usuário (1 = tudo, 0.5 = dividido com a noiva) e itens
------------------------------------------------------------------------------
alter table public.goals
  add column my_share numeric(5, 4) not null default 1 check (my_share > 0 and my_share <= 1);

create table public.goal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- cash: tudo à vista | installments: entrada (opcional) + parcelas
  payment text not null check (payment in ('cash', 'installments')),
  -- preço à vista do item (referência para calcular o custo dos juros)
  amount numeric(12, 2) not null check (amount > 0),
  -- só parcelado: entrada a guardar e parcelas
  down_payment numeric(12, 2) not null default 0 check (down_payment >= 0),
  installments smallint check (installments is null or installments between 1 and 120),
  installment_amount numeric(12, 2) check (installment_amount is null or installment_amount > 0),
  first_month date check (first_month is null or first_month = date_trunc('month', first_month)::date),
  -- o que já foi pago: à vista (ou entrada) em reais, parcelas em quantidade
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  paid_installments smallint not null default 0 check (paid_installments >= 0),
  created_at timestamptz not null default now(),
  constraint goal_items_installment_fields check (
    payment = 'cash'
    or (installments is not null and installment_amount is not null and first_month is not null)
  ),
  constraint goal_items_paid_amount check (
    paid_amount <= case when payment = 'cash' then amount else down_payment end
  ),
  constraint goal_items_paid_installments check (paid_installments <= coalesce(installments, 0)),
  constraint goal_items_down_le_amount check (down_payment <= amount)
);
create index goal_items_goal on public.goal_items (goal_id);

alter table public.month_incomes enable row level security;
alter table public.goal_items enable row level security;

create policy own_rows on public.month_incomes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- o item só vale se o objetivo também for do usuário
create policy own_rows on public.goal_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid())
  );

revoke all on public.month_incomes, public.goal_items from anon;
