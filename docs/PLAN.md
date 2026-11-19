# Bot Vidhi: Phase 1 plan

_Moved over from the claude.ai Project "bot project" on 2026-11-18. Decisions and
current status are in `/CLAUDE.md`. This file adds the details: user flows, the clip
script, and the concepts learned along the way._

## The two experiences

**His page (`index.html`), iPhone Safari**
1. Logs in with username + password (stays logged in).
2. The avatar greets him based on **Tokyo** time (morning / night clip).
3. Six actions: **Mood · Win 🎉 · Vent 😤 · I miss you · Voice note 🎙️ · (history)**.
4. Each action is saved, and an auto reply plays (avatar expression + clip + caption + label).
5. Bottom tab bar: **Recent** (default) · Bot replies · Vids's replies 💌 · Full history.

**Her dashboard (`dashboard.html`), Android**
1. A timeline of everything he did, with **both** times (his Tokyo time + her NY time).
2. Plays his voice notes, and shows which auto reply he got.
3. A reply box (text, voice later), saved as 💌 Vids replied.

## Avatar → moment mapping
| Expression | File | Used when |
|---|---|---|
| Neutral / greeting | `avatar-neutral.png` | Page opens, idle |
| Happy | `avatar-happy.png` | Wins, good moods |
| Comfort | `avatar-comfort.png` | Vents, low moods |
| Love | `avatar-love.png` | "I miss you", (maybe) opening a 💌 reply |
| Sleep | `avatar-sleep.png` | Shown when it's night in NY ("Vids is asleep") |

## Voice clip script
Rules: quiet room · 5–15 s · **.m4a or .mp3** (not WhatsApp .opus) · the caption is exactly what you said.

| File | Plays when | Caption |
|---|---|---|
| `greet-morning-1` ⭐ | Opens page, Tokyo morning | |
| `greet-morning-2` | Same (alternate) | |
| `greet-night-1` ⭐ | Opens page, Tokyo evening | |
| `missyou-1` ⭐ | Taps "I miss you" | |
| `missyou-2`, `missyou-3` | Same (alternates) | |
| `missyou-milestone` | His 10th "I miss you" | |
| `win-1` ⭐, `win-2` | Shares a win | |
| `vent-1` ⭐, `vent-2` | Vents (comfort + promise to listen properly later) | |
| `mood-low` ⭐ | Picks a sad / stressed mood | |
| `voicenote-thanks` ⭐ | Sends a voice note | |

⭐ = core 7 for launch. Alternates exist because of **habituation**: the same clip
every time quickly stops feeling personal.

## Build order
1. ✅ Database tables + Row Level Security (`supabase/01_database.sql`)
2. Sign-ups off, 2 users, roles, private storage buckets, upload clips
3. His page, step by step
4. Her dashboard
5. Push to GitHub + turn on Pages
6. Test on his real iPhone: mic, playback, login, "logged out sees nothing"

## Concepts (classroom checkpoints)
| # | Concept | Question |
|---|---|---|
| 1 | Frontend vs backend | Why can't his phone and hers share storage directly? |
| 2 | Store-and-forward | Post office vs filing cabinet? |
| 3 | UTC + named time zones | Why is "+12" a bug waiting to happen? |
| 4 | Authentication vs authorization | Which one stops a stranger who has the key? |
| 5 | Public vs secret keys | Why is one safe to publish? |
| 6 | Database row vs file storage | Why does the link go in the table and the file in storage? |
| 7 | AI-mediated communication (HCI) | Is a pre-recorded clip "you" or "the bot"? |
| 8 | Cross-platform testing | Why test on a real iPhone? |
| 9 | Server region / latency ✅ | Why put the server near the person who needs speed? |
| 10 | Identifier vs recovery channel ✅ | Why do apps use email instead of usernames? |
| 11 | Least privilege ✅ | Why not give him your Supabase login? |
| 12 | Defense in depth ✅ | Why turn sign-ups off if RLS already protects data? |
| 13 | Error accumulation ✅ | Why edit each avatar from the base image? |
| 14 | Habituation ✅ | Why alternate clips? |
| 15 | Storage vs views ✅ | Why are 4 tabs still one table? |
| 16 | Whose "day"? ✅ | Why does "today" follow Tokyo midnight? |
| 17 | Constraints as rules ✅ | Why enforce honesty labels in the database, not just the page? |
| 18 | Policies vs grants ✅ | Which rows vs which actions/columns? |
| 19 | Onboarding docs ✅ | Why does a CLAUDE.md / README matter on a team? |
