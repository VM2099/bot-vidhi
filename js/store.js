// =====================================================================
// Bot Vidhi · js/store.js · THE DATA LAYER (the "seam")
// ---------------------------------------------------------------------
// This is the ONLY file in the project that knows where data is kept.
// Right now it keeps everything in the browser's localStorage, so the
// pages can be built and seen with no backend at all.
//
// Later, a file called store-supabase.js will offer the SAME function
// names backed by the real database. Swapping one <script> tag will be
// the whole migration: his page and the dashboard never change.
//
// That is why every object below uses the EXACT column names from
// supabase/01_database.sql. The mock speaks the database's language.
//
// Loaded as a plain script (not type="module") on purpose: modules are
// blocked by browsers when you open a file straight off disk, and Vids
// needs to be able to double-click index.html while building.
//
// EVERY function that touches data returns a PROMISE, even though
// localStorage answers instantly. That is on purpose. Supabase has to
// ask a server in Tokyo, so it can only ever return a promise. If the
// mock answered instantly, the pages would be written in a style that
// breaks the day the real backend arrives. A mock must copy the SHAPE
// of reality, including the waiting.
//
// Pure, local things (time formatting, labels, the role switch) stay
// synchronous, because they will never need the network.
//
// Read top to bottom: every block has a comment saying WHY.
// =====================================================================

(function (global) {
  'use strict';

  // -------------------------------------------------------------------
  // PART 0 · Storage that cannot crash the page
  // localStorage THROWS (not returns null) in Safari private mode and
  // when a browser blocks site data. A page that dies on load is worse
  // than a page that forgets, so every read and write is wrapped and
  // falls back to plain memory for the session.
  // -------------------------------------------------------------------
  const SCHEMA = 'v1';                       // bump this if the shape changes
  const K_EVENTS = 'botvidhi.' + SCHEMA + '.events';
  const K_NEXTID = 'botvidhi.' + SCHEMA + '.nextId';
  const K_WHOAMI = 'botvidhi.' + SCHEMA + '.whoami';

  const memory = {};                         // the fallback drawer
  let usingMemory = false;

  function readRaw(key) {
    try {
      const v = global.localStorage.getItem(key);
      return v === null ? undefined : v;
    } catch (e) {
      usingMemory = true;
      return memory[key];
    }
  }

  function writeRaw(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (e) {
      // Quota exceeded, or site data blocked. Keep the session working.
      usingMemory = true;
      memory[key] = value;
    }
  }

  function readJson(key, fallback) {
    const raw = readRaw(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Corrupted or hand-edited. Do not wipe it silently; warn and
      // start fresh so the page still works.
      console.warn('[store] could not parse ' + key + ', starting empty');
      return fallback;
    }
  }

  // -------------------------------------------------------------------
  // PART 1 · The vocabulary, copied from the database check constraints
  // If a page tries to invent a new kind, we want to find out HERE, not
  // three weeks later when Postgres rejects the insert.
  // -------------------------------------------------------------------
  const SENDERS = ['friend', 'vids', 'bot'];
  const KINDS = ['visit', 'mood', 'win', 'vent', 'miss_you', 'voice_note', 'reply'];
  const REPLY_SOURCES = ['prerecorded', 'vids', 'ai'];
  const CATEGORIES = [
    'greet_morning', 'greet_night',
    'miss_you', 'miss_you_milestone',
    'win', 'vent', 'mood_low', 'voice_note_thanks'
  ];

  // Moods that should get a comforting clip rather than a cheerful one.
  const LOW_MOODS = ['sad', 'low', 'tired', 'stressed', 'anxious', 'lonely'];

  // -------------------------------------------------------------------
  // PART 2 · The clip catalogue
  // In mock mode there is NO audio: voice clips are private and never go
  // to GitHub. audio_path stays null and the UI shows the caption (or
  // the key) instead. captions are null because they are not written
  // yet, so the data stays honest about what it does not have.
  // -------------------------------------------------------------------
  const CLIPS = [
    { key: 'greet-morning-1',    category: 'greet_morning',      caption: null, audio_path: null, active: true,  core: true },
    { key: 'greet-morning-2',    category: 'greet_morning',      caption: null, audio_path: null, active: false, core: false },
    { key: 'greet-night-1',      category: 'greet_night',        caption: null, audio_path: null, active: true,  core: true },
    { key: 'missyou-1',          category: 'miss_you',           caption: null, audio_path: null, active: true,  core: true },
    { key: 'missyou-2',          category: 'miss_you',           caption: null, audio_path: null, active: false, core: false },
    { key: 'missyou-3',          category: 'miss_you',           caption: null, audio_path: null, active: false, core: false },
    { key: 'missyou-milestone',  category: 'miss_you_milestone', caption: null, audio_path: null, active: false, core: false },
    { key: 'win-1',              category: 'win',                caption: null, audio_path: null, active: true,  core: true },
    { key: 'win-2',              category: 'win',                caption: null, audio_path: null, active: false, core: false },
    { key: 'vent-1',             category: 'vent',               caption: null, audio_path: null, active: true,  core: true },
    { key: 'vent-2',             category: 'vent',               caption: null, audio_path: null, active: false, core: false },
    { key: 'mood-low',           category: 'mood_low',           caption: null, audio_path: null, active: true,  core: true },
    { key: 'voicenote-thanks',   category: 'voice_note_thanks',  caption: null, audio_path: null, active: true,  core: true }
  ];

  // init() is where the Supabase version will fetch the clip catalogue
  // once and cache it. The mock has nothing to fetch, but the pages
  // should await it anyway so the startup order is already correct.
  async function init() {
    return health();
  }

  async function getClips() {
    return CLIPS.map(function (c) { return Object.assign({}, c); });
  }

  // findClip and clipLabel stay synchronous: they read the catalogue
  // that init() has already loaded, so rendering never has to wait.
  function findClip(key) {
    for (let i = 0; i < CLIPS.length; i++) {
      if (CLIPS[i].key === key) return CLIPS[i];
    }
    return null;
  }

  // What to show next to a clip while there is no audio and no caption.
  function clipLabel(key) {
    const c = findClip(key);
    if (!c) return key;
    return c.caption ? c.caption : '\u{1F399} ' + c.key;
  }

  // -------------------------------------------------------------------
  // PART 3 · Time zones
  // Never store or compute with a fixed offset. "+9" would be a lie for
  // New York twice a year. We store an exact instant (ISO 8601, UTC)
  // and let Intl apply a NAMED zone only when displaying.
  // -------------------------------------------------------------------
  const TOKYO = 'Asia/Tokyo';
  const NEW_YORK = 'America/New_York';

  function partsIn(zone, date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const out = {};
    fmt.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  // "Which calendar day is it for HIM?" as 'YYYY-MM-DD' in Tokyo.
  // His day is the one that decides what "Recent" means.
  function tokyoDayKey(date) {
    const p = partsIn(TOKYO, date || new Date());
    return p.year + '-' + p.month + '-' + p.day;
  }

  // Step back one calendar day by treating the key as a plain date.
  // Doing arithmetic on the KEY, not on milliseconds, stays correct even
  // in a zone that changes its clocks.
  function previousDayKey(key) {
    const bits = key.split('-');
    const d = new Date(Date.UTC(+bits[0], +bits[1] - 1, +bits[2]));
    d.setUTCDate(d.getUTCDate() - 1);
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return d.getUTCFullYear() + '-' + m + '-' + day;
  }

  function tokyoHour(date) {
    return parseInt(partsIn(TOKYO, date || new Date()).hour, 10);
  }

  function formatIn(zone, iso) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    }).format(new Date(iso));
  }

  function fmtTokyo(iso) { return formatIn(TOKYO, iso); }
  function fmtNewYork(iso) { return formatIn(NEW_YORK, iso); }

  // Just the clock face, for the two little time chips at the top.
  // Still in here rather than in the page, because knowing which zones
  // exist is this file's job and nobody else's.
  function clockIn(zone, date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour: 'numeric', minute: '2-digit'
    }).format(date || new Date());
  }
  function clockTokyo(date) { return clockIn(TOKYO, date); }
  function clockNewYork(date) { return clockIn(NEW_YORK, date); }

  // Is Vids probably asleep right now? (for the sleeping avatar)
  function vidsIsAsleep(date) {
    const h = parseInt(partsIn(NEW_YORK, date || new Date()).hour, 10);
    return h >= 23 || h < 7;
  }

  // -------------------------------------------------------------------
  // PART 4 · Fake identity, and why it is fenced off
  // There is no real login in mock mode. This switch exists so Vids can
  // see both sides on one laptop. It is NOT security: it is a costume.
  //
  // A comment saying "dev only" stops nobody, so the switch refuses to
  // work off a development host. On GitHub Pages it throws unless you
  // knowingly set Store.allowDevAuth = true. The REAL answer arrives
  // with Supabase: the server stops trusting the client at all.
  // -------------------------------------------------------------------
  function isDevHost() {
    try {
      if (global.location && global.location.protocol === 'file:') return true;
      const h = (global.location && global.location.hostname) || '';
      return h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
             h === '[::1]' || /\.localhost$/.test(h) || h === '';
    } catch (e) {
      return false;
    }
  }

  function currentUser() {
    const who = readRaw(K_WHOAMI);
    return who === 'vids' || who === 'friend' ? who : 'friend';
  }

  function setCurrentUser(role) {
    if (role !== 'vids' && role !== 'friend') {
      throw new Error('[store] role must be "vids" or "friend", got: ' + role);
    }
    if (!isDevHost() && api.allowDevAuth !== true) {
      throw new Error(
        '[store] the identity switch is for development hosts only. ' +
        'Set Store.allowDevAuth = true if you really mean to use it here.'
      );
    }
    writeRaw(K_WHOAMI, role);
    return role;
  }

  // -------------------------------------------------------------------
  // PART 5 · The honesty rules, mirrored from the database
  // These are the same two constraints as reply_needs_source and
  // sender_matches_source in 01_database.sql, plus the row-level rules
  // about who may write what.
  //
  // IMPORTANT: this is a MIRROR for catching bugs early, not security.
  // Anyone can edit localStorage, and anyone can edit the JavaScript.
  // The rule is only truly enforced once Postgres is the one checking.
  // -------------------------------------------------------------------
  function validateEvent(e) {
    if (SENDERS.indexOf(e.sender) === -1) {
      throw new Error('[store] bad sender: ' + e.sender);
    }
    if (KINDS.indexOf(e.kind) === -1) {
      throw new Error('[store] bad kind: ' + e.kind);
    }
    if (e.reply_source !== null && REPLY_SOURCES.indexOf(e.reply_source) === -1) {
      throw new Error('[store] bad reply_source: ' + e.reply_source);
    }

    // reply_needs_source: a reply must say where it came from, and
    // nothing else may claim a source.
    const isReply = e.kind === 'reply';
    const hasSource = e.reply_source !== null;
    if (isReply !== hasSource) {
      throw new Error('[store] a reply must have a reply_source, and only a reply may have one');
    }

    // sender_matches_source: the label can never contradict the sender.
    const ok =
      (e.sender === 'friend' && !isReply) ||
      (e.sender === 'vids' && isReply && e.reply_source === 'vids') ||
      (e.sender === 'bot' && isReply && (e.reply_source === 'prerecorded' || e.reply_source === 'ai'));
    if (!ok) {
      throw new Error('[store] sender "' + e.sender + '" may not send kind "' +
                      e.kind + '" with source "' + e.reply_source + '"');
    }

    // Foreign key: a clip_key must name a clip we actually have.
    if (e.clip_key !== null && !findClip(e.clip_key)) {
      throw new Error('[store] unknown clip_key: ' + e.clip_key);
    }
    return true;
  }

  // The RLS insert policies, in JavaScript.
  function assertMayInsert(role, e) {
    if (role === 'friend') {
      const allowed = e.sender === 'friend' ||
                      (e.sender === 'bot' && e.reply_source === 'prerecorded');
      if (!allowed) {
        throw new Error('[store] he may only write his own actions and pre-recorded replies');
      }
      return;
    }
    if (role === 'vids') {
      if (e.sender !== 'vids') {
        throw new Error('[store] Vids may only write her own replies');
      }
      return;
    }
    throw new Error('[store] unknown role: ' + role);
  }

  // -------------------------------------------------------------------
  // PART 6 · Reading and writing events
  // -------------------------------------------------------------------
  function allEvents() {
    const rows = readJson(K_EVENTS, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveEvents(rows) {
    writeRaw(K_EVENTS, JSON.stringify(rows));
  }

  function nextId() {
    const n = parseInt(readRaw(K_NEXTID) || '1', 10);
    writeRaw(K_NEXTID, String(n + 1));
    return n;
  }

  // addEvent(draft) returns the saved row.
  // Mirrors `insert into events (...)`. Fills the defaults the database
  // would fill (id, created_at, created_by) so both versions behave the
  // same from the page's point of view.
  // There is deliberately NO way for a caller to say "write this as
  // somebody else". An `as:` override would let his page hand itself
  // the vids role and forge a 💌 reply, which is exactly the thing the
  // rules below exist to prevent. The role always comes from here.
  async function addEvent(draft) {
    const role = currentUser();
    const row = {
      id: null,
      created_at: new Date().toISOString(),   // an instant, in UTC
      created_by: role,                       // a uuid in the real thing
      sender: draft.sender,
      kind: draft.kind,
      body: draft.body === undefined ? null : draft.body,
      mood: draft.mood === undefined ? null : draft.mood,
      audio_path: draft.audio_path === undefined ? null : draft.audio_path,
      clip_key: draft.clip_key === undefined ? null : draft.clip_key,
      reply_source: draft.reply_source === undefined ? null : draft.reply_source,
      in_reply_to: draft.in_reply_to === undefined ? null : draft.in_reply_to,
      seen_by_vids_at: null
    };

    validateEvent(row);
    assertMayInsert(role, row);

    const rows = allEvents();
    if (row.in_reply_to !== null && !rows.some(function (r) { return r.id === row.in_reply_to; })) {
      throw new Error('[store] in_reply_to points at no event: ' + row.in_reply_to);
    }

    row.id = nextId();
    rows.push(row);
    saveEvents(rows);
    return row;
  }

  // addReply(text, inReplyTo) is Vids's reply. A convenience wrapper so
  // the dashboard never has to remember the three honesty fields.
  // It does NOT grant the vids role: if his page calls this, addEvent
  // rejects it, because the role still comes from currentUser().
  async function addReply(text, inReplyTo) {
    return addEvent({
      sender: 'vids',
      kind: 'reply',
      reply_source: 'vids',
      body: text,
      in_reply_to: inReplyTo === undefined ? null : inReplyTo
    });
  }

  // listEvents(filter) returns newest first.
  // The four tabs on his page are four FILTERS over one list. Same data,
  // four views, which is exactly how the real table works.
  async function listEvents(filter) {
    const rows = allEvents().slice().sort(function (a, b) {
      if (a.created_at === b.created_at) return b.id - a.id;
      return a.created_at < b.created_at ? 1 : -1;
    });

    if (!filter || filter === 'all') return rows;

    if (filter === 'recent') {
      // "Today and yesterday" by HIS calendar, not hers and not UTC.
      const today = tokyoDayKey(new Date());
      const yesterday = previousDayKey(today);
      return rows.filter(function (r) {
        const k = tokyoDayKey(new Date(r.created_at));
        return k === today || k === yesterday;
      });
    }
    if (filter === 'bot') {
      return rows.filter(function (r) { return r.kind === 'reply' && r.sender === 'bot'; });
    }
    if (filter === 'vids') {
      return rows.filter(function (r) { return r.kind === 'reply' && r.sender === 'vids'; });
    }
    throw new Error('[store] unknown filter: ' + filter);
  }

  async function getEvent(id) {
    const rows = allEvents();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  // markSeen(id) is the ONLY update the database allows, and only for
  // Vids (grant update (seen_by_vids_at)). Mirrored here.
  async function markSeen(id) {
    if (currentUser() !== 'vids') {
      throw new Error('[store] only Vids may mark an event as seen');
    }
    const rows = allEvents();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === id) {
        rows[i].seen_by_vids_at = new Date().toISOString();
        saveEvents(rows);
        return rows[i];
      }
    }
    return null;
  }

  // The honesty label. One place decides it, so no screen can get it
  // wrong or quietly leave it off.
  function replyLabel(e) {
    if (e.kind !== 'reply') return null;
    if (e.sender === 'vids') return '\u{1F48C} Vids replied';
    if (e.reply_source === 'prerecorded') return '\u{1F399} Pre-recorded by Vids';
    if (e.reply_source === 'ai') return '\u{1F916} Bot Vidhi (AI)';
    return null;
  }

  // -------------------------------------------------------------------
  // PART 7 · Which clip answers this?
  // Lives here because choosing well needs the HISTORY, and history is
  // what this file owns. Habituation: the same clip every time stops
  // feeling personal, so pick the one played least recently.
  // -------------------------------------------------------------------
  function categoryFor(kind, mood, when) {
    if (kind === 'visit') return tokyoHour(when) < 12 ? 'greet_morning' : 'greet_night';
    if (kind === 'win') return 'win';
    if (kind === 'vent') return 'vent';
    if (kind === 'voice_note') return 'voice_note_thanks';
    if (kind === 'miss_you') return 'miss_you';
    if (kind === 'mood') {
      // Only low moods have a clip. A good mood gets no clip rather than
      // a wrong one: better silent than tone-deaf.
      return LOW_MOODS.indexOf(String(mood)) === -1 ? null : 'mood_low';
    }
    return null;
  }

  // pickClip(kind, mood) returns a clip key, or null if nothing fits.
  async function pickClip(kind, mood, when) {
    let category = categoryFor(kind, mood, when);
    if (category === null) return null;

    // His 10th "I miss you" earns the milestone clip, if it is ready.
    if (kind === 'miss_you') {
      const count = allEvents().filter(function (r) {
        return r.kind === 'miss_you' && r.sender === 'friend';
      }).length;
      if ((count + 1) % 10 === 0) {
        const milestone = CLIPS.filter(function (c) {
          return c.active && c.category === 'miss_you_milestone';
        });
        if (milestone.length) category = 'miss_you_milestone';
      }
    }

    const candidates = CLIPS.filter(function (c) {
      return c.active && c.category === category;
    });
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0].key;

    // When was each candidate last played? Never played wins.
    const lastPlayed = {};
    allEvents().forEach(function (r) {
      if (r.clip_key) {
        lastPlayed[r.clip_key] = Math.max(lastPlayed[r.clip_key] || 0, r.id);
      }
    });

    let best = candidates[0];
    let bestSeen = lastPlayed[best.key] || 0;
    candidates.forEach(function (c) {
      const seen = lastPlayed[c.key] || 0;
      if (seen < bestSeen) { best = c; bestSeen = seen; }
    });
    return best.key;
  }

  // -------------------------------------------------------------------
  // PART 8 · Dev helpers
  // exportJson() matters more than it looks: it is how today's mock data
  // gets carried into Supabase later instead of being thrown away.
  // -------------------------------------------------------------------
  async function exportJson() {
    return JSON.stringify({ schema: SCHEMA, events: allEvents() }, null, 2);
  }

  async function reset() {
    saveEvents([]);
    writeRaw(K_NEXTID, '1');
  }

  function health() {
    return {
      schema: SCHEMA,
      backend: 'localStorage (mock)',
      persistent: !usingMemory,
      devHost: isDevHost(),
      whoami: currentUser(),
      events: allEvents().length
    };
  }

  // -------------------------------------------------------------------
  // The public surface. His page and the dashboard may use ONLY these.
  // store-supabase.js will offer exactly these names.
  //
  //   await  -> init, addEvent, addReply, listEvents, getEvent,
  //             markSeen, getClips, pickClip, exportJson, reset
  //   sync   -> findClip, clipLabel, replyLabel, the time helpers,
  //             currentUser, setCurrentUser, isDevHost, health
  // -------------------------------------------------------------------
  const api = {
    SENDERS: SENDERS, KINDS: KINDS, REPLY_SOURCES: REPLY_SOURCES, CATEGORIES: CATEGORIES,
    allowDevAuth: false,

    init: init,
    addEvent: addEvent,
    addReply: addReply,
    listEvents: listEvents,
    getEvent: getEvent,
    markSeen: markSeen,

    getClips: getClips,
    findClip: findClip,
    clipLabel: clipLabel,
    pickClip: pickClip,
    replyLabel: replyLabel,

    currentUser: currentUser,
    setCurrentUser: setCurrentUser,
    isDevHost: isDevHost,

    tokyoDayKey: tokyoDayKey,
    previousDayKey: previousDayKey,
    tokyoHour: tokyoHour,
    fmtTokyo: fmtTokyo,
    fmtNewYork: fmtNewYork,
    clockTokyo: clockTokyo,
    clockNewYork: clockNewYork,
    vidsIsAsleep: vidsIsAsleep,

    exportJson: exportJson,
    reset: reset,
    health: health
  };

  global.Store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
