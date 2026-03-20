-- ─── Correction History ───────────────────────────────────────────────────────
-- Persists every correction result so students can review past work.
-- Fire-and-forget insert from /api/tutor after a successful correction.

create table if not exists corrections_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  workflow       text not null check (workflow in ('text-correction', 'audio-correction', 'ocr-correction')),
  original       text not null,
  corrected      text not null,
  error_type     text,
  error_categories text[] default '{}',
  cefr_estimate  text,
  confidence     numeric(4,3),
  explanation_de text,
  session_id     uuid
);

-- RLS: users see only their own history
alter table corrections_history enable row level security;

create policy "corrections_history_select_own"
  on corrections_history for select
  using (auth.uid() = user_id);

create policy "corrections_history_insert_own"
  on corrections_history for insert
  with check (auth.uid() = user_id);

-- Index for fast per-user history queries
create index if not exists corrections_history_user_created
  on corrections_history (user_id, created_at desc);
