-- Hardening and consistency update for Nossa Rotina.

create or replace function public.routine_create_household(
  p_name text,
  p_person_key text,
  p_display_name text
)
returns table(household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household public.routine_households%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_person_key not in ('jonathan', 'isabella') then
    raise exception 'invalid person key';
  end if;

  if exists (select 1 from public.routine_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a routine';
  end if;

  insert into public.routine_households(name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nossa Rotina'), auth.uid())
  returning * into v_household;

  insert into public.routine_members(household_id, user_id, person_key, display_name, role)
  values (
    v_household.id,
    auth.uid(),
    p_person_key,
    coalesce(nullif(trim(p_display_name), ''), initcap(p_person_key)),
    'owner'
  );

  insert into public.routine_state(household_id, schema_version, data, updated_by)
  values (v_household.id, 3, '{}'::jsonb, auth.uid());

  return query select v_household.id, v_household.invite_code;
end;
$$;

create or replace function public.routine_join_household(
  p_invite_code text,
  p_person_key text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_person_key not in ('jonathan', 'isabella') then
    raise exception 'invalid person key';
  end if;

  if exists (select 1 from public.routine_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a routine';
  end if;

  select h.id
  into v_household_id
  from public.routine_households h
  where h.invite_code = upper(trim(p_invite_code));

  if v_household_id is null then
    raise exception 'invite code not found';
  end if;

  if exists (
    select 1
    from public.routine_members m
    where m.household_id = v_household_id
      and m.person_key = p_person_key
  ) then
    raise exception 'person profile already occupied';
  end if;

  insert into public.routine_members(household_id, user_id, person_key, display_name, role)
  values (
    v_household_id,
    auth.uid(),
    p_person_key,
    coalesce(nullif(trim(p_display_name), ''), initcap(p_person_key)),
    'member'
  );

  return v_household_id;
end;
$$;

create or replace function public.routine_touch_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists routine_state_touch on public.routine_state;
create trigger routine_state_touch
before update on public.routine_state
for each row execute function public.routine_touch_state();

revoke execute on function public.routine_create_household(text,text,text) from public, anon;
revoke execute on function public.routine_join_household(text,text,text) from public, anon;
revoke execute on function public.routine_is_member(uuid) from public, anon;

grant execute on function public.routine_create_household(text,text,text) to authenticated;
grant execute on function public.routine_join_household(text,text,text) to authenticated;
grant execute on function public.routine_is_member(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'routine_state'
  ) then
    alter publication supabase_realtime add table public.routine_state;
  end if;
end $$;
