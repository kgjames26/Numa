-- One private NUMA budget document per authenticated user.
create table if not exists public.numa_budgets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.numa_budgets enable row level security;
revoke all on table public.numa_budgets from anon, authenticated;
grant select, insert, update on table public.numa_budgets to authenticated;

drop policy if exists "Read own NUMA budget" on public.numa_budgets;
create policy "Read own NUMA budget"
  on public.numa_budgets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Insert own NUMA budget" on public.numa_budgets;
create policy "Insert own NUMA budget"
  on public.numa_budgets for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Update own NUMA budget" on public.numa_budgets;
create policy "Update own NUMA budget"
  on public.numa_budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The expected timestamp prevents an offline device from silently overwriting
-- a newer cloud copy. A concurrent change returns NUMA_SYNC_CONFLICT.
create or replace function public.save_numa_budget(
  p_payload jsonb,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid NUMA budget payload';
  end if;

  insert into public.numa_budgets as current_budget (user_id, payload, updated_at)
  values ((select auth.uid()), p_payload, pg_catalog.clock_timestamp())
  on conflict (user_id) do update
    set payload = excluded.payload,
        updated_at = pg_catalog.clock_timestamp()
    where current_budget.updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception using message = 'NUMA_SYNC_CONFLICT', errcode = '40001';
  end if;
  return v_updated_at;
end;
$$;

revoke all on function public.save_numa_budget(jsonb, timestamptz) from public, anon;
grant execute on function public.save_numa_budget(jsonb, timestamptz) to authenticated;
