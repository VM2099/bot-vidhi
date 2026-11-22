// =====================================================================
// Bot Vidhi · js/app.js · HIS PAGE
// ---------------------------------------------------------------------
// This file draws the screen and nothing else. It never touches
// localStorage, never mentions Supabase, and never builds an event by
// hand. Everything goes through Store, which is the seam.
//
// Every Store call is awaited, because the real backend will answer
// over a network. Writing it this way now means the Supabase swap
// changes one <script> tag and not this file.
// =====================================================================

(function () {
  'use strict';

  // --- which face for which moment (from docs/PLAN.md) ---------------
  const FACE = {
    neutral: 'assets/avatars/avatar-neutral.png',
    happy: 'assets/avatars/avatar-happy.png',
    comfort: 'assets/avatars/avatar-comfort.png',
    love: 'assets/avatars/avatar-love.png',
    sleep: 'assets/avatars/avatar-sleep.png'
  };

  // The moods he can pick. The 'low' ones are the ones store.js has a
  // comforting clip for; the others deliberately get no clip at all.
  const MOODS = [
    { key: 'happy',    icon: '\u{1F604}', label: 'good' },
    { key: 'calm',     icon: '\u{1F642}', label: 'calm' },
    { key: 'tired',    icon: '\u{1F634}', label: 'tired' },
    { key: 'stressed', icon: '\u{1F623}', label: 'stressed' },
    { key: 'sad',      icon: '\u{1F622}', label: 'sad' },
    { key: 'lonely',   icon: '\u{1F97A}', label: 'lonely' }
  ];

  const KIND_ICON = {
    visit: '\u{1F44B}', mood: '\u{1F60A}', win: '\u{1F389}',
    vent: '\u{1F624}', miss_you: '\u{1F497}', voice_note: '\u{1F399}',
    reply: '\u{1F4AC}'
  };

  const KIND_WORD = {
    visit: 'opened the page', mood: 'mood', win: 'a win',
    vent: 'a vent', miss_you: 'missing her', voice_note: 'voice note',
    reply: 'reply'
  };

  const TAB_HEADING = {
    recent: 'Today and yesterday, your time',
    bot: 'Replies in her recorded voice',
    vids: 'What Vids wrote back',
    all: 'Everything, newest first'
  };

  const TAB_EMPTY = {
    recent: 'Nothing yet today. Tap something above.',
    bot: 'No recorded replies yet.',
    vids: 'Nothing from Vids yet. She replies when she wakes up.',
    all: 'Your history starts with your first tap.'
  };

  // --- tiny DOM helpers ----------------------------------------------
  const $ = (id) => document.getElementById(id);

  // Build nodes and set TEXT, never innerHTML, for anything a person
  // typed. Otherwise a message containing < would break the page, and
  // one containing a <script> tag would be worse.
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  let activeTab = 'recent';
  let openAction = null;      // 'win' | 'vent' | 'mood' | null

  // ===================================================================
  // The header: face, greeting, two clocks
  // ===================================================================
  function setFace(name) {
    $('avatar').src = FACE[name] || FACE.neutral;
  }

  function idleFace() {
    // Her plan: the sleeping face whenever it is night in Rochester.
    return Store.vidsIsAsleep() ? 'sleep' : 'neutral';
  }

  function greetingText() {
    const h = Store.tokyoHour();
    if (h < 5) return 'You are up late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function renderHeader() {
    $('greeting').textContent = greetingText();
    $('clockTokyo').textContent = Store.clockTokyo();
    $('clockNy').textContent = Store.clockNewYork();
    $('sleepnote').textContent = Store.vidsIsAsleep()
      ? 'Vids is probably asleep. She will see this when she wakes up.'
      : 'Vids is probably awake right now.';
  }

  // ===================================================================
  // The reply card
  // ===================================================================
  function renderReply(replyEvent) {
    const card = $('replyCard');
    card.textContent = '';

    if (!replyEvent) { card.hidden = true; return; }

    const label = Store.replyLabel(replyEvent);
    if (label) {
      const tag = el('span', 'reply__label', label);
      if (replyEvent.sender === 'vids') tag.classList.add('reply__label--vids');
      card.appendChild(tag);
    }

    if (replyEvent.body) card.appendChild(el('p', 'reply__body', replyEvent.body));

    if (replyEvent.clip_key) {
      const clip = Store.findClip(replyEvent.clip_key);
      const slot = el('div', 'clipslot');
      slot.appendChild(el('span', 'clipslot__icon', '\u{1F399}'));
      const txt = el('div', 'clipslot__text');
      if (clip && clip.caption) {
        txt.appendChild(el('span', 'clipslot__key', clip.caption));
      } else {
        txt.appendChild(el('span', 'clipslot__key', replyEvent.clip_key));
      }
      // Say plainly why there is no sound. A silent play button would
      // look broken; this looks unfinished, which is the truth.
      txt.appendChild(document.createTextNode('her voice clip goes here, not uploaded yet'));
      slot.appendChild(txt);
      card.appendChild(slot);
    }

    card.hidden = false;
  }

  // A confirmation for the moments that honestly have no reply, so the
  // page still answers without putting words in her mouth.
  function renderAck(text) {
    const card = $('replyCard');
    card.textContent = '';
    card.appendChild(el('p', 'reply__body', text));
    card.hidden = false;
  }

  // ===================================================================
  // The feed. Four tabs, one list, four filters.
  // ===================================================================
  async function renderFeed() {
    const rows = await Store.listEvents(activeTab);
    const list = $('feed');
    const empty = $('empty');

    $('feedHeading').textContent = TAB_HEADING[activeTab];
    list.textContent = '';

    if (!rows.length) {
      empty.textContent = TAB_EMPTY[activeTab];
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    rows.forEach(function (r) {
      const li = el('li', 'ev ev--' + r.kind);
      li.appendChild(el('span', 'ev__icon', KIND_ICON[r.kind] || '\u{2022}'));

      const main = el('div', 'ev__main');
      main.appendChild(el('div', 'ev__kind', KIND_WORD[r.kind] || r.kind));

      if (r.body) main.appendChild(el('p', 'ev__body', r.body));
      if (r.mood) main.appendChild(el('p', 'ev__body', 'feeling ' + r.mood));

      if (r.clip_key) {
        const clip = Store.findClip(r.clip_key);
        main.appendChild(el('p', 'ev__body',
          (clip && clip.caption) ? clip.caption : '\u{1F399} ' + r.clip_key));
      }

      const label = Store.replyLabel(r);
      if (label) {
        const tag = el('span', 'ev__label', label);
        if (r.sender === 'vids') tag.classList.add('ev__label--vids');
        main.appendChild(tag);
      }

      // Both clocks on every row: his time first, because it is his
      // page, and hers underneath so the distance is always visible.
      const meta = el('div', 'ev__meta');
      meta.appendChild(el('span', null, 'you · ' + Store.fmtTokyo(r.created_at)));
      meta.appendChild(el('span', null, 'Vids · ' + Store.fmtNewYork(r.created_at)));
      if (r.seen_by_vids_at) {
        meta.appendChild(el('span', 'ev__seen', 'Vids has seen this'));
      }
      main.appendChild(meta);

      li.appendChild(main);
      list.appendChild(li);
    });
  }

  // ===================================================================
  // Doing something
  // ===================================================================
  const FACE_FOR = {
    win: 'happy', vent: 'comfort', miss_you: 'love',
    voice_note: 'happy', visit: 'neutral'
  };

  function faceFor(kind, mood) {
    if (kind === 'mood') {
      return (mood === 'happy' || mood === 'calm') ? 'happy' : 'comfort';
    }
    return FACE_FOR[kind] || 'neutral';
  }

  // One path for every action: save what he did, ask the store which
  // clip answers it, save that reply too. If there is no clip, we say
  // so instead of inventing one.
  async function act(kind, opts) {
    const o = opts || {};
    try {
      const his = await Store.addEvent({
        sender: 'friend', kind: kind,
        body: o.body || null, mood: o.mood || null
      });

      setFace(faceFor(kind, o.mood));

      const clipKey = await Store.pickClip(kind, o.mood);
      if (clipKey) {
        const reply = await Store.addEvent({
          sender: 'bot', kind: 'reply', reply_source: 'prerecorded',
          clip_key: clipKey, in_reply_to: his.id
        });
        renderReply(reply);
      } else {
        renderAck('Saved. Vids will see this when she wakes up.');
      }

      await renderFeed();
    } catch (e) {
      // The honesty rules live in the store and they throw. Never fail
      // silently: show him something true.
      renderAck('That did not save: ' + e.message);
      console.error(e);
    }
  }

  // ===================================================================
  // Composer and mood chips
  // ===================================================================
  const COMPOSER_PROMPT = {
    win: 'What went well?',
    vent: 'Get it out. She will hear this properly when she wakes up.'
  };

  function closePanels() {
    openAction = null;
    $('composer').hidden = true;
    $('moods').hidden = true;
    document.querySelectorAll('.action').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  function openComposer(kind) {
    closePanels();
    openAction = kind;
    $('composerLabel').textContent = COMPOSER_PROMPT[kind];
    $('composerText').value = '';
    $('composer').hidden = false;
    document.querySelector('.action[data-act="' + kind + '"]')
      .setAttribute('aria-expanded', 'true');
    $('composerText').focus();
  }

  function openMoods() {
    closePanels();
    openAction = 'mood';
    $('moods').hidden = false;
    document.querySelector('.action[data-act="mood"]')
      .setAttribute('aria-expanded', 'true');
  }

  function buildMoodChips() {
    const row = $('moodRow');
    MOODS.forEach(function (m) {
      const b = el('button', 'chip', m.icon + '  ' + m.label);
      b.type = 'button';
      b.addEventListener('click', async function () {
        closePanels();
        await act('mood', { mood: m.key });
      });
      row.appendChild(b);
    });
  }

  // ===================================================================
  // The dev bar. Only on a development host, because store.js refuses
  // to switch roles anywhere else.
  // ===================================================================
  function renderDevBar() {
    if (!Store.isDevHost()) return;
    const bar = $('devbar');
    bar.hidden = false;

    const btn = $('devRole');
    const paint = function () {
      btn.textContent = 'I am: ' + (Store.currentUser() === 'vids' ? 'Vids' : 'him');
    };
    paint();

    btn.addEventListener('click', async function () {
      Store.setCurrentUser(Store.currentUser() === 'vids' ? 'friend' : 'vids');
      paint();
      await renderFeed();
    });

    $('devReset').addEventListener('click', async function () {
      await Store.reset();
      renderReply(null);
      setFace(idleFace());
      await renderFeed();
    });
  }

  // ===================================================================
  // Startup
  // ===================================================================
  function isGreetingReply(r) {
    if (r.kind !== 'reply' || r.sender !== 'bot' || !r.clip_key) return false;
    const clip = Store.findClip(r.clip_key);
    return !!clip && (clip.category === 'greet_morning' || clip.category === 'greet_night');
  }

  // Greeting him and RECORDING the visit are two different things, and
  // confusing them was a real bug: the first version only greeted him
  // on his first open of the day, so every later visit was met with
  // silence.
  //
  //   greeting  = a moment on screen, every single time he opens it
  //   visit row = a record in the history, at most once per Tokyo day
  //
  // Without the daily limit his real messages would drown in "opened
  // the page" noise. Without the greeting every time, the avatar just
  // sits there saying nothing, which is the opposite of the point.
  async function greetOnOpen() {
    const today = Store.tokyoDayKey();
    const rows = await Store.listEvents('all');       // newest first
    const visitedToday = rows.some(function (r) {
      return r.kind === 'visit' &&
             Store.tokyoDayKey(new Date(r.created_at)) === today;
    });

    if (!visitedToday) {
      const visit = await Store.addEvent({ sender: 'friend', kind: 'visit' });
      const clipKey = await Store.pickClip('visit');
      if (clipKey) {
        const reply = await Store.addEvent({
          sender: 'bot', kind: 'reply', reply_source: 'prerecorded',
          clip_key: clipKey, in_reply_to: visit.id
        });
        renderReply(reply);
      }
      return;
    }

    // Already counted as visiting today, so greet him with the welcome
    // he has already been given rather than inventing a new record.
    const lastGreeting = rows.find(isGreetingReply);
    if (lastGreeting) renderReply(lastGreeting);
  }

  async function start() {
    await Store.init();

    renderHeader();
    setFace(idleFace());
    buildMoodChips();
    renderDevBar();

    document.querySelectorAll('.action').forEach(function (b) {
      b.addEventListener('click', async function () {
        const kind = b.dataset.act;
        if (kind === 'win' || kind === 'vent') { openComposer(kind); return; }
        if (kind === 'mood') {
          if (openAction === 'mood') { closePanels(); } else { openMoods(); }
          return;
        }
        if (kind === 'voice_note') {
          closePanels();
          // No fake recorder. Recording needs somewhere private to put
          // the file, and that arrives with Supabase Storage.
          renderAck('Voice notes need private storage, so they arrive with the real backend. Not pretending for now.');
          return;
        }
        closePanels();
        await act(kind, {});
      });
    });

    $('composerSend').addEventListener('click', async function () {
      const text = $('composerText').value.trim();
      if (!text) { $('composerText').focus(); return; }
      const kind = openAction;
      closePanels();
      await act(kind, { body: text });
    });
    $('composerCancel').addEventListener('click', closePanels);

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', async function () {
        activeTab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === t));
        });
        await renderFeed();
      });
    });

    await greetOnOpen();
    await renderFeed();

    // Keep the two clocks honest while the page sits open.
    setInterval(renderHeader, 30000);
  }

  // The scripts are plain, so by the time this runs the DOM below it
  // may not exist yet. Wait for it.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
