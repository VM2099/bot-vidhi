# Bot Vidhi: instructions for Claude

Claude Code reads this file at the start of every session. It carries over
the plan and working rules from the claude.ai Project "bot project".
Full plan: `docs/PLAN.md`.

---

## How to work with Vids (always follow)

- **Who:** Vids (Vidushi), MS HCI student at RIT. This is a **portfolio + learning
  project**. She is building skills for software, IoT, UX engineering, HCI and
  research roles.
- **Teach like a classroom.** For each step, explain the concept in plain words.
  Ask a question and answer it yourself. Then leave her one "your turn" question
  to think about. Link each step to real-job skills where it fits.
- **Write or change code ONLY after she says "build".** Before that, propose the
  plan and ask for confirmation. Explaining, reading, and checking are fine
  anytime.
- **Step by step, in phases.** One step at a time. Don't run ahead.
- **Facts vs. inferences.** Mark anything you're not sure about with ❓.
- **Look for gaps and opportunities** (UX, security, honesty, edge cases).
- She is visual and creative. Tables, small diagrams and examples help.
- Her devices: Vids = **Android**; her friend = **iPhone (Safari)**.

---

## Status (as of 2026-11-18, 7 PM NY)

| Item | State |
|---|---|
| Supabase project `bot-vidhi` | ✅ Created. Tokyo region (`ap-northeast-1`), Postgres 17, free plan |
| Project URL | `https://mtqrggnpiquxrirmimwv.supabase.co` |
| Publishable key (public by design) | `sb_publishable_KV7UnXhy_GjXkXmFjXxcYQ___rPsApR` |
| Step 1 database script | ✅ Written + tested on local Postgres 16 (13/13 permission tests passed). ❓ **Not yet confirmed run in her real project.** Ask her first |
| GitHub repo | `VM2099/bot-vidhi`, public, **empty**. This folder has **not** been pushed yet |
| Avatars | ✅ `assets/avatars/`, 5 PNGs, 418×726, transparent, shared crop so they line up |
| Voice clips | Recorded on her phone. **Not uploaded.** Captions not written yet. Must be .m4a/.mp3 |
| Free-tier pausing fix | Deferred by Vids. Suggested: **both**, see "Open decisions" |

### First things to do in Claude Code
1. **Check Step 1 ran.** Ask whether Supabase → Table Editor shows `clips`, `events`,
   `profiles`. You can also verify yourself as a logged-out visitor:
   `curl "$URL/rest/v1/events?select=*" -H "apikey: $KEY"` should be **refused**
   (permission denied / 401), never return rows. If the tables are missing, walk her
   through SQL Editor → New query → paste `supabase/01_database.sql` → Run.
2. **First push to GitHub.** Teach git as you go (repo, commit, remote, push).
   Check `.gitignore` before the first commit. Never commit voice clips or secrets.
3. **Propose Step 2** (below) and wait for "build".

---

## Locked decisions

| Topic | Decision |
|---|---|
| What it is | Mobile web page where he talks to Vids's cartoon avatar while she sleeps. Everything is saved; Vids sees it on her dashboard and can reply |
| His location | Tokyo, `Asia/Tokyo` (UTC+9, no DST) |
| Her location | Rochester NY, `America/New_York`. The gap is **14 h** (NY winter) / **13 h** (NY summer). Never hard-code an offset |
| Stack | **Vanilla JavaScript**, no framework. Supabase JS client from a CDN |
| Hosting | GitHub Pages (HTTPS, which the mic needs) |
| Backend | Supabase: Postgres + Auth + Storage, with Row Level Security |
| Pages | `index.html` (his page), `dashboard.html` (hers) |
| Logins | Email + password via Supabase Auth. **Public sign-ups OFF.** Vids creates both accounts as already-confirmed users |
| His login | Username **`BlovesVidhi`**. The page lowercases it and maps it to a made-up email (`blovesvidhi@<made-up-domain>`). ❓ Supabase may reject some made-up domains, so test it. No "forgot password" for him; Vids resets it in the dashboard. **His password is never stored anywhere in code or docs** |
| Roles | `profiles` table maps user id → `vids` / `friend`. Rows are added by Vids in SQL (never by the page) |
| Replies | Voice + text caption, always labelled: 🎙️ Pre-recorded by Vids · 💌 Vids replied · 🤖 Bot Vidhi (AI, later phase) |
| His 4 tabs (bottom tab bar) | **Recent** (default; today + yesterday by **Tokyo** calendar day) · Bot replies · Vids's replies 💌 · Full history. All 4 are filters over the one `events` table |
| Her dashboard | Every event shows **both** Tokyo time and NY time. Playable voice notes, reply box |

### Database design (Step 1, `supabase/01_database.sql`)
- `profiles`: `id` (= auth user id), `role` ('vids'|'friend'), `display_name`
- `clips`: `key` (e.g. `missyou-2`), `category`, `caption` (nullable, filled in later), `audio_path`, `active`
- `events`: one row per thing that happens. `sender` ('friend'|'vids'|'bot'),
  `kind` ('visit','mood','win','vent','miss_you','voice_note','reply'), `body`,
  `mood`, `audio_path`, `clip_key`, `reply_source` ('prerecorded'|'vids'|'ai'),
  `in_reply_to`, `seen_by_vids_at`, `created_by`, `created_at` (timestamptz)
- Check constraints enforce honesty: a reply must have a `reply_source`, and the sender must match it.
- RLS: both roles read everything. The friend may insert his own actions and
  `bot`/`prerecorded` replies only. Only Vids inserts `vids` replies. Only Vids may
  update, and only `seen_by_vids_at`. No deletes via the API. `anon` has no
  table grants at all.
- Helper `public.my_role()` is SECURITY DEFINER (avoids RLS recursion), executable by `authenticated` only.

### Voice clip set (files go to private Storage, never GitHub)
Core 7 for launch: `greet-morning-1`, `greet-night-1`, `missyou-1`, `win-1`,
`vent-1`, `mood-low`, `voicenote-thanks`.
Extras: `greet-morning-2`, `missyou-2`, `missyou-3`, `missyou-milestone` (his 10th
"I miss you"), `win-2`, `vent-2`.
Vent clips must comfort (never cheerful) and promise "I'll hear this properly when I wake up."

---

## Security rules (non-negotiable)

| Thing | Where it lives |
|---|---|
| HTML / JS / CSS, avatars | GitHub (public). Fine |
| Publishable / anon key | In the code. Public by design; RLS protects the data |
| **Secret / service_role key** | **Never** in code, commits, chat or this file |
| Database password, app passwords | Her password manager only |
| Voice clips, his voice notes, vents | Supabase **private** Storage, logged-in only |

If Vids ever pastes a secret key or password, tell her right away and help her rotate it.

---

## Step 2 (proposed, NOT built; wait for "build")
1. Supabase → Authentication → turn **off** public sign-ups.
2. Create 2 users (Authentication → Users → Add user → "Auto confirm"): Vids's real email, and his made-up email.
3. SQL `02_roles.sql`: insert the 2 `profiles` rows (Vids pastes the two user ids).
4. SQL `03_storage.sql`: private buckets `clips` (Vids writes, both read) and
   `voice-notes` (each person writes, both read), with storage RLS policies.
5. Vids uploads the core 7 clips. Insert matching `clips` rows (captions can be empty).

Remaining build order: **3** his page → **4** her dashboard → **5** push + GitHub Pages →
**6** test on his real iPhone (Safari mic needs HTTPS + a tap; iOS records mp4/AAC).

---

## Open decisions
- **Free-tier pausing** (Supabase pauses free projects after ~7 days of low activity).
  Suggestion: both (a) a GitHub Action every ~3 days that runs a real database
  query through an `anon`-callable RPC (❓ unclear whether plain API hits count as
  "activity", so do a real query), and (b) a friendly "Bot Vidhi is waking up 💤" message.
- Tab name: "Bot replies" vs "Bot Vidhi" (not blocking).
- Should the avatar switch to `love` when he opens a 💌 reply?
- Gift message text (after the build).

## Known gaps / Phase 2+
Push notifications · "unheard vents" badge on the dashboard · Home Screen install
(PWA; also helps with iOS wiping storage after ~7 days unvisited ❓) · custom SMTP for
real password resets · AI replies (🤖) with consent + labels · "open when…"
messages · load-more / search in Full history · avatar blinking (SVG eyes).

## Avatar notes
Made from her AI-generated originals (white background removed by flood-fill from
the edges, then all 5 cropped to one shared box). ❓ Tiny white specks sit inside
some hair curls. They're invisible on light backgrounds and visible on very dark
ones, so keep the page background light/pastel.
