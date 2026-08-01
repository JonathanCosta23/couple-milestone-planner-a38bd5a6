create extension if not exists pgcrypto;

create table if not exists public.routine_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa Rotina',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_members (
  household_id uuid not null references public.routine_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_key text not null check (person_key in ('jonathan','isabella')),
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, person_key)
);

create table if not exists public.routine_state (
  household_id uuid primary key references public.routine_households(id) on delete cascade,
  schema_version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.routine_is_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.routine_members where household_id=p_household_id and user_id=auth.uid());
$$;

create or replace function public.routine_create_household(p_name text,p_person_key text,p_display_name text)
returns table(household_id uuid,invite_code text)
language plpgsql security definer set search_path=public as $$
declare v_household public.routine_households%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 insert into public.routine_households(name,created_by) values(coalesce(nullif(trim(p_name),''),'Nossa Rotina'),auth.uid()) returning * into v_household;
 insert into public.routine_members(household_id,user_id,person_key,display_name,role) values(v_household.id,auth.uid(),p_person_key,p_display_name,'owner');
 insert into public.routine_state(household_id,data,updated_by) values(v_household.id,'{}'::jsonb,auth.uid());
 return query select v_household.id,v_household.invite_code;
end;$$;

create or replace function public.routine_join_household(p_invite_code text,p_person_key text,p_display_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_household_id uuid;
begin
 select id into v_household_id from public.routine_households where invite_code=upper(trim(p_invite_code));
 if v_household_id is null then raise exception 'invite code not found'; end if;
 insert into public.routine_members(household_id,user_id,person_key,display_name,role)
 values(v_household_id,auth.uid(),p_person_key,p_display_name,'member')
 on conflict(household_id,user_id) do update set person_key=excluded.person_key,display_name=excluded.display_name;
 return v_household_id;
end;$$;

alter table public.routine_households enable row level security;
alter table public.routine_members enable row level security;
alter table public.routine_state enable row level security;

create policy "members_read_household" on public.routine_households for select to authenticated using(public.routine_is_member(id));
create policy "members_read_members" on public.routine_members for select to authenticated using(public.routine_is_member(household_id));
create policy "members_read_state" on public.routine_state for select to authenticated using(public.routine_is_member(household_id));
create policy "members_update_state" on public.routine_state for update to authenticated using(public.routine_is_member(household_id)) with check(public.routine_is_member(household_id));

grant execute on function public.routine_create_household(text,text,text) to authenticated;
grant execute on function public.routine_join_household(text,text,text) to authenticated;
grant select on public.routine_households,public.routine_members,public.routine_state to authenticated;
grant update on public.routine_state to authenticated;