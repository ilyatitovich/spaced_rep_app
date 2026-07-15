-- Tombstone garbage collection via device watermarks.
-- Each device reports its pull watermark (last_pulled_at) and last_seen_at.
-- A soft-deleted row is safe to hard-delete once every active device has pulled
-- past its deleted_at, or once it is older than the safety TTL (for lost devices).

create table if not exists public.sync_devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_pulled_at timestamptz not null default 'epoch',
  last_seen_at timestamptz not null default now(),
  user_agent text
);

create index if not exists sync_devices_user_last_seen_idx
  on public.sync_devices (user_id, last_seen_at);

alter table public.sync_devices enable row level security;

create policy "Users manage own devices"
  on public.sync_devices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hard-delete tombstones that every active device has already applied, plus any
-- tombstone older than the TTL so a lost/abandoned device cannot block cleanup.
create or replace function public.purge_synced_tombstones()
returns void
language plpgsql
security invoker
as $$
declare
  ttl_cutoff timestamptz := now() - interval '30 days';
  min_pulled timestamptz;
begin
  select min(last_pulled_at) into min_pulled
  from public.sync_devices
  where user_id = auth.uid()
    and last_seen_at > ttl_cutoff;

  delete from public.sync_devices
  where user_id = auth.uid()
    and last_seen_at <= ttl_cutoff;

  delete from public.cards
  where user_id = auth.uid()
    and deleted_at is not null
    and (deleted_at <= min_pulled or deleted_at < ttl_cutoff);

  -- Hard-deleting a topic cascades to its cards via the topics FK.
  delete from public.topics
  where user_id = auth.uid()
    and deleted_at is not null
    and (deleted_at <= min_pulled or deleted_at < ttl_cutoff);
end;
$$;

grant execute on function public.purge_synced_tombstones() to authenticated;
