// =====================================================================
// Bot Vidhi · tests/store.test.js
// ---------------------------------------------------------------------
// Run it:   node tests/store.test.js
//
// Node is NOT part of the app. It is only a way to run these checks
// without opening a browser. The app itself never touches Node.
//
// There is no test framework here on purpose: no npm, no install, no
// version to keep up to date. Two helpers (ok and rejects) are enough.
//
// What these tests are FOR: the honesty rules. The whole promise of
// Bot Vidhi is that every reply says where it came from, so the tests
// spend most of their effort trying to tell lies and being refused.
// The first version of store.js passed a careless review and still let
// his page forge a "Vids replied" message. A test caught it. Keep them.
// =====================================================================

const path = require('path');

// --- a localStorage that works in Node -------------------------------
function makeShim() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}
globalThis.localStorage = makeShim();

const Store = require(path.join(__dirname, '..', 'js', 'store.js'));

// --- the two helpers -------------------------------------------------
let pass = 0, fail = 0;

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// Every data call returns a promise, so "it must be refused" means
// "the promise must reject".
async function rejects(name, fn, needle) {
  try {
    await fn();
    fail++;
    console.log('  FAIL  ' + name + '  -> expected a refusal, but it was accepted');
  } catch (e) {
    if (!needle || e.message.indexOf(needle) !== -1) {
      pass++; console.log('  PASS  ' + name);
    } else {
      fail++; console.log('  FAIL  ' + name + '  -> wrong error: ' + e.message);
    }
  }
}

function section(t) { console.log('\n' + t); }

async function main() {
  // ===================================================================
  section('1 · wiring');
  const h = await Store.init();
  ok('init resolves', typeof h === 'object');
  ok('persistent storage detected', Store.health().persistent === true,
    JSON.stringify(Store.health()));
  ok('defaults to the friend role', Store.currentUser() === 'friend');
  const clips = await Store.getClips();
  ok('13 clips in the catalogue', clips.length === 13, String(clips.length));
  ok('7 clips active for launch', clips.filter(c => c.active).length === 7);
  ok('no clip has audio yet (none is in the repo)',
    clips.every(c => c.audio_path === null));

  // ===================================================================
  section('2 · the seam really is asynchronous');
  // If any of these were plain values, the pages would be written in a
  // style that breaks when Supabase arrives.
  ok('listEvents returns a promise', typeof Store.listEvents('all').then === 'function');
  ok('addEvent returns a promise',
    typeof Store.addEvent({ sender: 'friend', kind: 'visit' }).then === 'function');
  ok('pickClip returns a promise', typeof Store.pickClip('win').then === 'function');
  ok('clipLabel stays synchronous (rendering must not wait)',
    typeof Store.clipLabel('win-1') === 'string');
  ok('fmtTokyo stays synchronous',
    typeof Store.fmtTokyo('2026-11-21T15:30:00Z') === 'string');

  // ===================================================================
  section('3 · time zones (the 13/14 hour gap)');
  ok('14:30 UTC is still Nov 21 in Tokyo',
    Store.tokyoDayKey(new Date('2026-11-21T14:30:00Z')) === '2026-11-21');
  ok('15:30 UTC has already become Nov 22 in Tokyo',
    Store.tokyoDayKey(new Date('2026-11-21T15:30:00Z')) === '2026-11-22');
  ok('previousDayKey crosses a month', Store.previousDayKey('2026-03-01') === '2026-02-28',
    Store.previousDayKey('2026-03-01'));
  ok('previousDayKey crosses a year', Store.previousDayKey('2027-01-01') === '2026-12-31');
  ok('Tokyo hour of 15:30 UTC is 0', Store.tokyoHour(new Date('2026-11-21T15:30:00Z')) === 0);
  const iso = '2026-11-21T15:30:00Z';
  console.log('         one instant, two calendars:');
  console.log('           Tokyo    ' + Store.fmtTokyo(iso));
  console.log('           New York ' + Store.fmtNewYork(iso));
  ok('the two zones show different days', Store.fmtTokyo(iso) !== Store.fmtNewYork(iso));
  ok('Vids is asleep at 06:00 NY', Store.vidsIsAsleep(new Date('2026-11-21T11:00:00Z')) === true);
  ok('Vids is awake at 14:00 NY', Store.vidsIsAsleep(new Date('2026-11-21T19:00:00Z')) === false);

  // ===================================================================
  section('4 · his actions are accepted');
  await Store.reset();
  Store.setCurrentUser('friend');
  const visit = await Store.addEvent({ sender: 'friend', kind: 'visit' });
  ok('visit saved with id 1', visit.id === 1, String(visit.id));
  ok('created_at is an ISO instant', /Z$/.test(visit.created_at));
  ok('seen_by_vids_at starts empty', visit.seen_by_vids_at === null);
  const win = await Store.addEvent({ sender: 'friend', kind: 'win', body: 'passed my kanji test' });
  ok('win saved', win.kind === 'win');
  const vent = await Store.addEvent({ sender: 'friend', kind: 'vent', body: 'long day' });
  ok('vent saved', vent.id === 3);
  await Store.addEvent({ sender: 'friend', kind: 'mood', mood: 'tired' });
  await Store.addEvent({ sender: 'friend', kind: 'miss_you' });
  ok('5 events stored', (await Store.listEvents('all')).length === 5);

  // ===================================================================
  section('5 · the honesty rules (mirrored from 01_database.sql)');
  await rejects('a reply with no source is refused',
    () => Store.addEvent({ sender: 'bot', kind: 'reply', body: 'hi' }),
    'must have a reply_source');
  await rejects('a non-reply carrying a source is refused',
    () => Store.addEvent({ sender: 'friend', kind: 'win', reply_source: 'vids' }),
    'only a reply may have one');
  await rejects('the bot may not claim to be Vids herself',
    () => Store.addEvent({ sender: 'bot', kind: 'reply', reply_source: 'vids' }),
    'may not send kind');
  await rejects('his page cannot forge a reply from Vids',
    () => Store.addEvent({ sender: 'vids', kind: 'reply', reply_source: 'vids', body: 'fake' }),
    'his own actions');
  await rejects('his page cannot forge an AI reply',
    () => Store.addEvent({ sender: 'bot', kind: 'reply', reply_source: 'ai', body: 'fake' }),
    'his own actions');
  await rejects('addReply does not hand out the vids role',
    () => Store.addReply('fake message from Vids'),
    'his own actions');
  await rejects('an invented kind is refused',
    () => Store.addEvent({ sender: 'friend', kind: 'shout' }), 'bad kind');
  await rejects('an unknown clip_key is refused',
    () => Store.addEvent({ sender: 'bot', kind: 'reply', reply_source: 'prerecorded', clip_key: 'nope-9' }),
    'unknown clip_key');
  await rejects('in_reply_to must point at something real',
    () => Store.addEvent({ sender: 'bot', kind: 'reply', reply_source: 'prerecorded', in_reply_to: 9999 }),
    'points at no event');

  // ===================================================================
  section('6 · pre-recorded replies and their labels');
  const clipKey = await Store.pickClip('win');
  ok('a win picks the win clip', clipKey === 'win-1', String(clipKey));
  const botReply = await Store.addEvent({
    sender: 'bot', kind: 'reply', reply_source: 'prerecorded',
    clip_key: clipKey, in_reply_to: win.id
  });
  ok('pre-recorded reply accepted from his page', botReply.sender === 'bot');
  ok('label says pre-recorded',
    Store.replyLabel(botReply).indexOf('Pre-recorded by Vids') !== -1,
    Store.replyLabel(botReply));
  ok('a vent picks the comfort clip', (await Store.pickClip('vent')) === 'vent-1');
  ok('a low mood picks the comfort clip', (await Store.pickClip('mood', 'sad')) === 'mood-low');
  ok('a good mood picks NO clip rather than a wrong one',
    (await Store.pickClip('mood', 'happy')) === null);
  ok('a morning visit picks the morning clip',
    (await Store.pickClip('visit', null, new Date('2026-11-21T00:00:00Z'))) === 'greet-morning-1');
  ok('an evening visit picks the night clip',
    (await Store.pickClip('visit', null, new Date('2026-11-21T12:00:00Z'))) === 'greet-night-1');
  ok('a non-reply has no label', Store.replyLabel(win) === null);

  // ===================================================================
  section('7 · only Vids may reply or mark seen');
  await rejects('the friend role cannot mark seen', () => Store.markSeen(win.id), 'only Vids');
  Store.setCurrentUser('vids');
  ok('switched to the vids role', Store.currentUser() === 'vids');
  const reply = await Store.addReply('I saw this when I woke up, I am proud of you', win.id);
  ok('Vids reply saved', reply.sender === 'vids' && reply.reply_source === 'vids');
  ok('label says Vids replied', Store.replyLabel(reply).indexOf('Vids replied') !== -1);
  ok('reply is attached to the win', reply.in_reply_to === win.id);
  const seen = await Store.markSeen(vent.id);
  ok('Vids can mark the vent seen', seen.seen_by_vids_at !== null);
  await rejects('a bad role is refused', async () => Store.setCurrentUser('admin'), 'must be');

  // ===================================================================
  section('8 · the four tabs are four filters over one list');
  const all = await Store.listEvents('all');
  const bot = await Store.listEvents('bot');
  const vids = await Store.listEvents('vids');
  const recent = await Store.listEvents('recent');
  ok('all = 7 rows', all.length === 7, String(all.length));
  ok('bot replies = 1', bot.length === 1, String(bot.length));
  ok('vids replies = 1', vids.length === 1, String(vids.length));
  ok('recent = everything made just now', recent.length === 7, String(recent.length));
  ok('newest first', all[0].id > all[all.length - 1].id);
  ok('bot tab holds only bot replies', bot.every(r => r.sender === 'bot' && r.kind === 'reply'));
  ok('vids tab holds only her replies', vids.every(r => r.sender === 'vids' && r.kind === 'reply'));
  await rejects('an unknown filter is refused', () => Store.listEvents('nonsense'), 'unknown filter');

  // ===================================================================
  section('9 · Recent really does hide older days');
  const before = (await Store.listEvents('all')).length;
  const raw = JSON.parse(globalThis.localStorage.getItem('botvidhi.v1.events'));
  raw.push({
    id: 999,
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    created_by: 'friend', sender: 'friend', kind: 'miss_you',
    body: null, mood: null, audio_path: null, clip_key: null,
    reply_source: null, in_reply_to: null, seen_by_vids_at: null
  });
  globalThis.localStorage.setItem('botvidhi.v1.events', JSON.stringify(raw));
  ok('the 5-day-old row is in Full history', (await Store.listEvents('all')).length === before + 1);
  ok('the 5-day-old row is NOT in Recent',
    (await Store.listEvents('recent')).every(r => r.id !== 999));

  // ===================================================================
  section('10 · the milestone clip falls back while it is inactive');
  await Store.reset();
  Store.setCurrentUser('friend');
  for (let i = 0; i < 9; i++) {
    await Store.addEvent({ sender: 'friend', kind: 'miss_you' });
  }
  ok('9 miss_you stored', (await Store.listEvents('all')).length === 9);
  ok('the 10th falls back to missyou-1, because the milestone clip is not active yet',
    (await Store.pickClip('miss_you')) === 'missyou-1');

  // ===================================================================
  section('11 · survives a browser that blocks storage');
  globalThis.localStorage = {
    getItem() { throw new Error('SecurityError: storage blocked'); },
    setItem() { throw new Error('SecurityError: storage blocked'); }
  };
  let crashed = false;
  try {
    Store.health();
    await Store.addEvent({ sender: 'friend', kind: 'visit' });
  } catch (e) {
    crashed = true;
    console.log('         threw: ' + e.message);
  }
  ok('the page does not crash when storage is blocked', crashed === false);
  ok('it reports that it is no longer persistent', Store.health().persistent === false);

  // ===================================================================
  console.log('\n' + '='.repeat(60));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('='.repeat(60));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nthe test run itself broke:\n', e);
  process.exit(2);
});
