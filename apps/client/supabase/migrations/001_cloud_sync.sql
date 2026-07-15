-- Cloud sync schema for the Spaced Repetition app.
-- The client (IndexedDB) stays the source of truth; these tables mirror it per user.
-- Conflict resolution is last-write-wins using the client-supplied updated_at.
-- Deletes are soft (deleted_at) so tombstones can propagate to other devices.

create table if not exists public.topics (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  pivot bigint not null,
  week jsonb not null,
  next_update_date bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  level int not null default 0,
  data jsonb not null,
  review_date bigint,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A user cannot have two live topics with the same title (matches the local unique index).
create unique index if not exists topics_user_title_unique
  on public.topics (user_id, title)
  where deleted_at is null;

create index if not exists topics_user_updated_at_idx
  on public.topics (user_id, updated_at);

create index if not exists cards_user_updated_at_idx
  on public.cards (user_id, updated_at);

create index if not exists cards_topic_id_idx
  on public.cards (topic_id);

alter table public.topics enable row level security;
alter table public.cards enable row level security;

create policy "Users manage own topics"
  on public.topics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own cards"
  on public.cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
