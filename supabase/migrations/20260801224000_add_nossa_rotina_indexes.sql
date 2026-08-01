create index if not exists routine_households_created_by_idx
  on public.routine_households(created_by);

create index if not exists routine_members_user_id_idx
  on public.routine_members(user_id);

create index if not exists routine_state_updated_by_idx
  on public.routine_state(updated_by);
