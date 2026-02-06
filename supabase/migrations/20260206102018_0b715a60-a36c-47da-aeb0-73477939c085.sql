-- Improve logging + make engagement uniqueness enforceable

-- Normalize existing data
update public.colosseum_engagement_log
set engagement_type = 'comment'
where engagement_type is null;

-- Ensure engagement_type is always present
alter table public.colosseum_engagement_log
  alter column engagement_type set default 'comment';

alter table public.colosseum_engagement_log
  alter column engagement_type set not null;

-- Add per-attempt status + error details
alter table public.colosseum_engagement_log
  add column if not exists status text not null default 'success',
  add column if not exists error_message text,
  add column if not exists http_status integer,
  add column if not exists response_body text,
  add column if not exists parent_post_id text;

-- Prevent duplicate engagements (idempotency)
create unique index if not exists colosseum_engagement_unique
  on public.colosseum_engagement_log (engagement_type, target_post_id);

create index if not exists colosseum_engagement_created_at_idx
  on public.colosseum_engagement_log (created_at desc);
