-- =====================================================================
-- Bot Vidhi · Step 1 · Database tables + Row Level Security
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to read top to bottom: every block has a comment saying WHY.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PART 1 · profiles  →  "who is Vids, who is him?"
-- Supabase Auth already stores logins in auth.users. That table knows
-- WHO you are (authentication), not what you're ALLOWED to do
-- (authorization). This small table adds the role.
-- Rows are added in Step 2, after the two accounts exist.
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('vids', 'friend')),
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Helper: "what is the role of the person making this request?"
-- SECURITY DEFINER lets it read profiles even though profiles has its
-- own RLS. Without it, a policy that checks profiles would trigger
-- profiles' policy, which checks profiles... (infinite loop).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke execute on function public.my_role() from public, anon;
grant  execute on function public.my_role() to authenticated;


-- ---------------------------------------------------------------------
-- PART 2 · clips  →  your pre-recorded voice clips (🎙️)
-- The ROW holds facts about the clip (caption, category).
-- The FILE lives in private Storage; the row only stores its path.
-- Captions can stay empty now and be filled in later.
-- ---------------------------------------------------------------------
create table public.clips (
  key        text primary key,          -- e.g. 'missyou-2'
  category   text not null check (category in (
               'greet_morning', 'greet_night',
               'miss_you', 'miss_you_milestone',
               'win', 'vent', 'mood_low', 'voice_note_thanks')),
  caption    text,                      -- exactly what you say (later)
  audio_path text not null,             -- path inside the 'clips' bucket
  active     boolean not null default true
);


-- ---------------------------------------------------------------------
-- PART 3 · events  →  ONE table for everything that happens
-- His actions AND every reply are rows here. The 4 tabs on his page
-- are just 4 filters over this one table (storage vs. views).
-- Times are stored as timestamptz = an exact instant (UTC inside).
-- Tokyo / New York are only applied when DISPLAYING.
-- ---------------------------------------------------------------------
create table public.events (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  created_by      uuid not null default auth.uid() references auth.users (id),

  sender          text not null check (sender in ('friend', 'vids', 'bot')),
  kind            text not null check (kind in (
                    'visit', 'mood', 'win', 'vent', 'miss_you', 'voice_note', 'reply')),

  body            text,                 -- typed words (win, vent, reply caption)
  mood            text,                 -- e.g. 'happy', 'tired', 'sad'
  audio_path      text,                 -- his voice note / your voice reply (Storage path)
  clip_key        text references public.clips (key),   -- which 🎙️ clip was played
  reply_source    text check (reply_source in ('prerecorded', 'vids', 'ai')),
  in_reply_to     bigint references public.events (id) on delete set null,

  seen_by_vids_at timestamptz,          -- for a future "unheard vents" badge

  -- Honesty rules enforced by the DATABASE, not just the page:
  -- a reply must say where it came from, and the sender must match.
  constraint reply_needs_source check ((kind = 'reply') = (reply_source is not null)),
  constraint sender_matches_source check (
       (sender = 'friend' and kind <> 'reply')
    or (sender = 'vids'   and kind = 'reply' and reply_source = 'vids')
    or (sender = 'bot'    and kind = 'reply' and reply_source in ('prerecorded', 'ai'))
  )
);

create index events_created_at_idx on public.events (created_at desc);
create index events_in_reply_to_idx on public.events (in_reply_to);


-- ---------------------------------------------------------------------
-- PART 4 · Turn on Row Level Security (default = deny everything)
-- Once RLS is on, NOTHING is readable/writable until a policy allows it.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clips    enable row level security;
alter table public.events   enable row level security;


-- ---------------------------------------------------------------------
-- PART 5 · Policies = the rules (who may do what)
-- auth.uid() = the logged-in user's id. Logged-out visitors have none.
-- ---------------------------------------------------------------------

-- profiles: you can see your own row; Vids can see both.
create policy "profiles: read own or vids reads all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'vids');

-- clips: both of you can read; only Vids can add or edit.
create policy "clips: both read"
  on public.clips for select to authenticated
  using (public.my_role() in ('vids', 'friend'));

create policy "clips: vids inserts"
  on public.clips for insert to authenticated
  with check (public.my_role() = 'vids');

create policy "clips: vids updates"
  on public.clips for update to authenticated
  using (public.my_role() = 'vids')
  with check (public.my_role() = 'vids');

-- events: both of you can read the whole conversation.
create policy "events: both read"
  on public.events for select to authenticated
  using (public.my_role() in ('vids', 'friend'));

-- events: his page may write HIS actions and 🎙️ auto-replies,
-- but can never write a row pretending to be "💌 Vids replied".
create policy "events: friend inserts own actions and auto replies"
  on public.events for insert to authenticated
  with check (
    public.my_role() = 'friend'
    and created_by = auth.uid()
    and (
         sender = 'friend'
      or (sender = 'bot' and reply_source = 'prerecorded')
    )
  );

-- events: only Vids may write 💌 replies.
create policy "events: vids inserts her replies"
  on public.events for insert to authenticated
  with check (
    public.my_role() = 'vids'
    and created_by = auth.uid()
    and sender = 'vids'
  );

-- events: only Vids may update (and only the "seen" column, see grants).
create policy "events: vids marks seen"
  on public.events for update to authenticated
  using (public.my_role() = 'vids')
  with check (public.my_role() = 'vids');

-- No delete policies: nobody can delete through the app.
-- (You can still delete from the Supabase dashboard as the owner.)


-- ---------------------------------------------------------------------
-- PART 6 · Grants = which doors exist at all (defense in depth)
-- Policies decide WHICH ROWS; grants decide WHICH ACTIONS/COLUMNS.
-- Logged-out visitors ("anon") get nothing, even before RLS is checked.
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.clips, public.events from anon, authenticated;

grant select                 on public.profiles to authenticated;
grant select, insert, update on public.clips    to authenticated;
grant select, insert         on public.events   to authenticated;
grant update (seen_by_vids_at) on public.events to authenticated;

-- Done. Expected result: "Success. No rows returned".
