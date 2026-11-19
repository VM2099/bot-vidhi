# Bot Vidhi 🤖💌

A small two-way "presence" app for two people living 13–14 hours apart
(Rochester, NY ↔ Tokyo).

When he misses me and I'm asleep, he can open a mobile page and talk to a cartoon
avatar of me. He can share his mood, a win, a vent, a voice note, or just tap
**"I miss you"**. The avatar answers with short clips I pre-recorded in my own
voice. Everything is saved, so when I wake up I see it all on my dashboard, with
both time zones, and I can reply personally.

> **Honesty by design:** every reply is labelled with where it came from.
> 🎙️ Pre-recorded by Vids · 💌 Vids replied · 🤖 Bot Vidhi (AI, future phase)
> The database itself rejects a reply that doesn't say its source.

## Status
🚧 Phase 1 in progress: database ✅ · logins & storage · his page · my dashboard · launch

## Tech
- Vanilla JavaScript, HTML, CSS, hosted on GitHub Pages
- Supabase: Postgres, Auth, private Storage, **Row Level Security**
- Times stored in UTC and shown in `Asia/Tokyo` and `America/New_York`

## Repo layout
```
assets/avatars/     5 avatar expressions (neutral, happy, comfort, love, sleep)
supabase/           SQL scripts, run in order in the Supabase SQL Editor
docs/PLAN.md        Phase 1 plan, decisions and concepts
CLAUDE.md           Working notes for my AI pair-programmer
```

## Privacy
This repo holds **code only**. Voice clips, voice notes and messages live in
private Supabase storage, readable only by our two accounts. The key in the code
is Supabase's *publishable* key, which is meant to be public. Row Level Security
is what protects the data.

---
Designed and built by Vidushi (MS HCI, RIT) as a portfolio + learning project.
