-- Fatura do cartão: um gasto pode ser a própria fatura (card_bill) e os gastos marcados com
-- on_card ficam "dentro" dela. Um gasto não pode ser as duas coisas ao mesmo tempo.
-- Item de objetivo parcelado também pode estar dentro da fatura (in_card_bill).

alter table public.recurring_expenses
  add column card_bill boolean not null default false,
  add constraint recurring_card_xor check (not (on_card and card_bill));
alter table public.month_entries
  add column card_bill boolean not null default false,
  add constraint entries_card_xor check (not (on_card and card_bill));
alter table public.goal_items
  add column in_card_bill boolean not null default false;

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

  insert into public.month_entries (user_id, month, recurring_id, name, category, amount, due_day, is_estimate, on_card, reimbursement, card_bill)
  select r.user_id, v_month, r.id, r.name, r.category,
         case when r.kind = 'variable' then
           coalesce((select round(avg(x.amount), 2)
                       from (select e.amount from public.month_entries e
                              where e.recurring_id = r.id and e.month < v_month
                                and e.is_estimate = false and e.skipped = false
                              order by e.month desc limit 3) x), r.amount)
         else r.amount end,
         r.due_day,
         r.kind = 'variable',
         r.on_card,
         r.reimbursement,
         r.card_bill
    from public.recurring_expenses r
   where r.user_id = auth.uid()
     and r.start_month <= v_month
     and (r.end_month is null or r.end_month >= v_month)
  on conflict do nothing;
end;
$$;

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
         on_card = r.on_card,
         reimbursement = r.reimbursement,
         card_bill = r.card_bill,
         amount = case when r.kind = 'fixed' and e.paid = false then r.amount else e.amount end
   where e.recurring_id = r.id and e.month >= v_from;
end;
$$;

