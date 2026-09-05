-- OG Landmark Supabase schema
-- Run this once in the Supabase SQL Editor before starting the Node server.

create table if not exists public.app_data (
  id bigint primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  token_hash text primary key,
  user_id bigint not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_sessions_user on public.auth_sessions (user_id);
create index if not exists idx_auth_sessions_expiry on public.auth_sessions (expires_at);

create table if not exists public.auth_challenges (
  email text not null,
  purpose text not null,
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  primary key (email, purpose)
);

-- The server uses the service-role key and keeps these tables private.
alter table public.app_data enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_challenges enable row level security;