-- Backfill Auth users that existed before the signup profile trigger was installed.
-- Missing profiles are assigned customer only; this migration never grants admin.

insert into public.profiles (id, full_name, role, status)
select
  u.id,
  nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
  'customer',
  true
from auth.users as u
where not exists (
  select 1
  from public.profiles as p
  where p.id = u.id
)
on conflict (id) do nothing;
