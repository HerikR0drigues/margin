-- Investimentos: parte da sobra do mês destinada a investir (não é gasto).
-- O valor planejado copia o do mês anterior, como o salário; `invest_done` marca "já aportei".

alter table public.month_settings
  add column invest numeric(12, 2) not null default 0 check (invest >= 0),
  add column invest_done boolean not null default false;

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

  insert into public.month_settings (user_id, month, salary, invest)
  select auth.uid(), v_month,
         coalesce((select s.salary from public.month_settings s
                    where s.user_id = auth.uid() and s.month < v_month
                    order by s.month desc limit 1), 0),
         coalesce((select s.invest from public.month_settings s
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

