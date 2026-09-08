/* Ergebnisfrei — front end.
   Everything here runs in the visitor's browser. It never sees a score
   until someone presses "Reveal score". */

// Hide the player while it is paused, because YouTube fills a paused player
// with related-video thumbnails that carry scorelines. Set this to false if
// you would rather not hide any part of the player at all — see README.
const VEIL_ON_PAUSE = true;

// Small black patches over YouTube's title strip and over the bottom-right
// corner where an advert's skip button previews the match thumbnail. Both let
// clicks through, so the controls underneath still work. This bends YouTube's
// rule about putting things in front of the player; set to false to stay clean.
const MASK_PLAYER_CHROME = true;

// Cover the WHOLE picture while an advert runs, rather than just the corner.
// Much more aggressive: YouTube's terms name interfering with adverts directly,
// so leave this off if the site is public. The corner patch above is enough to
// stop the skip preview spoiling you.
const HIDE_ADVERTS = false;

// Built-in copy of the demo matches, used only when the page is opened straight
// from your desktop. Safe to delete once the site is live.
const OFFLINE_DEMO = {
  updatedAt: null,
  matches: [
    { id: 'DEMO_01', publishedAt: '2026-09-06T18:40:00Z', matchday: 3, duration: 24, cutAt: 20,
      home: { abbr: 'FCB', short: 'Bayern', primary: '#DC052D', secondary: '#0066B2' },
      away: { abbr: 'BVB', short: 'Dortmund', primary: '#FDE100', secondary: '#1A1A1A' } },
    { id: 'DEMO_02', publishedAt: '2026-09-06T18:20:00Z', matchday: 3, duration: 24, cutAt: 20,
      home: { abbr: 'RBL', short: 'Leipzig', primary: '#DD0741', secondary: '#001F47' },
      away: { abbr: 'FCU', short: 'Union Berlin', primary: '#EB1923', secondary: '#FFED02' } },
    { id: 'DEMO_03', publishedAt: '2026-09-06T16:10:00Z', matchday: 3, duration: 24, cutAt: 20,
      home: { abbr: 'STP', short: 'St. Pauli', primary: '#624735', secondary: '#E30613' },
      away: { abbr: 'SGE', short: 'Frankfurt', primary: '#E1000F', secondary: '#1A1A1A' } },
    { id: 'DEMO_04', publishedAt: '2026-09-05T20:30:00Z', matchday: 3, duration: 24, cutAt: 20,
      home: { abbr: 'B04', short: 'Leverkusen', primary: '#E32221', secondary: '#1A1A1A' },
      away: { abbr: 'SCF', short: 'Freiburg', primary: '#E2001A', secondary: '#1A1A1A' } },
    { id: 'DEMO_05', publishedAt: '2026-08-30T18:30:00Z', matchday: 2, duration: 24, cutAt: 20,
      home: { abbr: 'HSV', short: 'Hamburg', primary: '#1A1A1A', secondary: '#0069B4' },
      away: { abbr: 'KOE', short: 'Köln', primary: '#ED1C24', secondary: '#FFFFFF' } }
  ]
};

const OFFLINE_SCORES = { DEMO_01: [2, 2], DEMO_02: [1, 0], DEMO_03: [3, 1], DEMO_04: [0, 0], DEMO_05: [2, 4] };

const board = document.getElementById('board');
let apiReady = null;
let closeOpenMatch = null; // only one match plays at a time

// ------------------------------------------------------------------ setup --

init();

async function init() {
  let data;
  try {
    const res = await fetch('data/videos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    // Opening index.html straight off your desktop blocks file loading, so fall
    // back to a few built-in demo matches. Online, this branch never runs.
    if (location.protocol === 'file:') data = OFFLINE_DEMO;
    else return showState('Nothing to show yet.', 'The matchday file has not been built. Run the update job on GitHub, then refresh.');
  }

  board.setAttribute('aria-busy', 'false');

  if (!data.matches?.length) {
    return showState('No matches yet.', 'Highlights usually appear a few hours after full time.');
  }

  if (data.matches.some((m) => m.id.startsWith('DEMO'))) {
    const note = document.createElement('p');
    note.className = 'demo-note';
    note.textContent = 'Demo data. These are stand-in matches so you can see how the site behaves. Real fixtures appear once the update job runs with your API key.';
    board.before(note);
  }

  const updated = document.getElementById('updated');
  if (data.updatedAt) {
    updated.textContent = 'Last checked ' + new Date(data.updatedAt).toLocaleString('en-GB', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London'
    });
  }

  render(data.matches);
}

function showState(title, detail) {
  board.setAttribute('aria-busy', 'false');
  board.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'state';
  const strong = document.createElement('strong');
  strong.textContent = title;
  p.append(strong, detail);
  board.append(p);
}

// ----------------------------------------------------------------- render --

function render(matches) {
  board.innerHTML = '';

  const groups = new Map();
  for (const m of matches) {
    const key = m.matchday ? `Matchday ${m.matchday}` : dayLabel(m.publishedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  for (const [label, list] of groups) {
    const head = document.createElement('h2');
    head.className = 'group-head';
    head.textContent = label;
    board.append(head);
    for (const m of list) board.append(matchEl(m));
  }
}

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London'
  });
}

function crest(team) {
  const el = document.createElement('span');
  el.className = 'crest';
  el.style.setProperty('--c1', team.primary);
  el.style.setProperty('--c2', team.secondary);
  el.style.setProperty('--label', readableOn(team.primary));
  el.textContent = team.abbr;
  return el;
}

function readableOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}

function matchEl(match) {
  const wrap = document.createElement('article');
  wrap.className = 'match';
  wrap.dataset.open = 'false';

  const row = document.createElement('button');
  row.className = 'match-row';
  row.type = 'button';
  row.setAttribute('aria-expanded', 'false');

  const teams = document.createElement('span');
  teams.className = 'teams';
  const names = document.createElement('span');
  names.className = 'names';
  const versus = document.createElement('span');
  versus.className = 'versus';
  versus.textContent = ' v ';
  names.append(match.home.short, versus, match.away.short);
  teams.append(crest(match.home), crest(match.away), names);

  const play = document.createElement('span');
  play.className = 'play';
  play.textContent = 'Watch';

  row.append(teams, play);

  const stage = document.createElement('div');
  stage.className = 'stage';

  wrap.append(row, stage);

  function close() {
    // Tearing the player down rather than hiding it, so nothing keeps playing
    // out of sight.
    if (stage.teardown) stage.teardown();
    stage.teardown = null;
    stage.replaceChildren();
    delete stage.dataset.finished;
    wrap.dataset.open = 'false';
    row.setAttribute('aria-expanded', 'false');
    play.textContent = 'Watch';
    if (closeOpenMatch === close) closeOpenMatch = null;
  }

  row.addEventListener('click', () => {
    if (wrap.dataset.open === 'true') return close();

    if (closeOpenMatch) closeOpenMatch();
    closeOpenMatch = close;

    wrap.dataset.open = 'true';
    row.setAttribute('aria-expanded', 'true');
    play.textContent = 'Close';
    openPlayer(stage, match);
  });

  return wrap;
}

// ----------------------------------------------------------------- player --

function loadApi() {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiReady;
}

async function openPlayer(stage, match) {
  const frame = document.createElement('div');
  frame.className = 'frame';

  const holder = document.createElement('div');
  holder.className = 'holder';

  const veil = document.createElement('div');
  veil.className = 'veil';
  const veilText = document.createElement('p');
  const action = document.createElement('button');
  action.className = 'btn';
  action.type = 'button';
  veil.append(veilText, action);
  frame.append(holder, veil);

  if (MASK_PLAYER_CHROME) {
    const top = document.createElement('div');
    top.className = 'mask mask--top';
    frame.append(top);
    // Only shown while an advert runs — see tick(). Labelled so you can find
    // YouTube's skip button without seeing the thumbnail behind it.
    const corner = document.createElement('div');
    corner.className = 'mask mask--corner';
    corner.textContent = 'Skip here';
    frame.append(corner);
  }

  function veilAs(mode) {
    frame.dataset.veiled = mode;
    action.hidden = mode === 'ad';
    action.disabled = false;
    if (mode === 'cover') {
      veilText.textContent = 'Ready when you are.';
      action.textContent = 'Play';
    } else if (mode === 'ad') {
      veilText.textContent = 'Advert playing. Click the bottom right corner to skip.';
    } else if (mode === 'paused') {
      veilText.textContent = 'Paused. YouTube fills a paused video with other matches and their scores, so the picture stays covered until you carry on.';
      action.textContent = 'Resume';
    }
  }

  // Covered from the outset: before playback starts, YouTube shows the video's
  // own thumbnail, and that thumbnail is a scoreboard.
  veilAs('cover');

  const controls = document.createElement('div');
  controls.className = 'stage-controls';
  const soundBtn = document.createElement('button');
  soundBtn.className = 'btn btn--quiet';
  soundBtn.type = 'button';
  soundBtn.textContent = 'Turn sound on';
  soundBtn.hidden = true;

  const fsBtn = document.createElement('button');
  fsBtn.className = 'btn btn--quiet';
  fsBtn.type = 'button';
  fsBtn.textContent = 'Fullscreen';
  controls.append(soundBtn, fsBtn);

  soundBtn.addEventListener('click', () => {
    try { player.unMute(); player.setVolume(100); } catch {}
    soundBtn.hidden = true;
  });

  fsBtn.addEventListener('click', () => {
    // Fullscreen the whole box, not the iframe, so the masks come too.
    const go = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (go) go.call(frame);
    else fsBtn.textContent = 'Fullscreen not supported here';
  });

  const after = document.createElement('div');
  after.className = 'after';
  const done = document.createElement('p');
  done.textContent = 'Stopped early, so YouTube could not suggest other matches.';
  const revealBtn = document.createElement('button');
  revealBtn.className = 'btn btn--quiet';
  revealBtn.type = 'button';
  revealBtn.textContent = 'Reveal score';
  after.append(done);
  if (match.hasScore || match.id.startsWith('DEMO')) after.append(revealBtn);

  revealBtn.addEventListener('click', async () => {
    revealBtn.replaceWith(await revealEl(match));
  });

  stage.append(frame, controls, after);

  const finish = () => {
    stage.dataset.finished = 'true';
    stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  if (match.id.startsWith('DEMO')) {
    frame.dataset.veiled = 'false';
    const mockTimer = mockPlayer(holder, match, finish);
    stage.teardown = () => clearInterval(mockTimer);
    return;
  }

  await loadApi();

  let started = false;
  let ticker;
  let lastAt = -1;
  let playAskedAt = Date.now();

  const player = new YT.Player(holder, {
    videoId: match.id,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      // Browsers block autoplay with sound, which used to strand the cover with
      // the thumbnail behind it. Muted autoplay is always allowed, so start
      // silent and turn the sound on the moment it is actually running.
      mute: 1,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
      cc_load_policy: 0,
      // YouTube's own fullscreen button would show the bare iframe and leave
      // the masks behind, so it is turned off in favour of our own.
      fs: 0,
      origin: location.origin
    },
    events: {
      onReady: (e) => { try { e.target.playVideo(); } catch {} },
      onError: () => {
        clearInterval(ticker);
        frame.replaceChildren(errorEl());
      }
    }
  });

  // Started here rather than inside onReady. That event does not always
  // arrive, and when it did not, the cover stayed up over a thumbnail with no
  // way past it. Polling asks the player directly instead of waiting to be told.
  ticker = setInterval(tick, 250);
  stage.teardown = () => {
    clearInterval(ticker);
    try { player.destroy(); } catch {}
  };

  // Last resort: if nothing has moved after eight seconds, say so rather than
  // sitting on a dead panel.
  setTimeout(() => {
    if (started) return;
    veilText.textContent = 'This one will not start. Close it and try another, or reload the page.';
    action.disabled = false;
    action.textContent = 'Try again';
  }, 8000);

  function markStarted() {
    if (started) return;
    started = true;
    try { player.unMute(); player.setVolume(100); } catch {}
    setTimeout(() => {
      try { if (player.isMuted()) soundBtn.hidden = false; } catch {}
    }, 600);
  }

  function tick() {
    let state = -1;
    let at = 0;
    try {
      if (typeof player.getPlayerState !== 'function') return;
      state = player.getPlayerState();
      at = player.getCurrentTime();
    } catch { return; }

    // YouTube puts the video title in the iframe's title attribute, which the
    // browser shows as a tooltip on hover — outside the player, where no mask
    // can reach it. The element is ours, so the attribute can go.
    try {
      const el = player.getIframe();
      if (el && el.title !== 'Match highlights') el.title = 'Match highlights';
    } catch {}

    // The match's own clock does not advance while an advert plays, so "the
    // clock is moving" is the test for the match itself being on screen. It
    // catches pre-rolls, mid-rolls and buffering without relying on YouTube
    // reporting an advert's duration, which it does not do dependably.
    const matchRunning = at > 0.2 && at !== lastAt;
    lastAt = at;

    // The patch over the skip preview stays up until the football is genuinely
    // running, and returns if the clock ever stalls again.
    frame.dataset.ad = matchRunning ? 'false' : 'true';

    // Once anything is on screen the thumbnail is gone, so the cover can lift.
    const somethingOnScreen = matchRunning
      || state === YT.PlayerState.PLAYING
      || Date.now() - playAskedAt > 3000;

    if (somethingOnScreen) {
      markStarted();
      if (HIDE_ADVERTS && !matchRunning) veilAs('ad');
      else if (frame.dataset.veiled !== 'paused' || matchRunning) frame.dataset.veiled = 'false';
    }

    if (matchRunning && at >= match.cutAt) {
      clearInterval(ticker);
      player.destroy();
      finish();
      return;
    }

    if (state === YT.PlayerState.PAUSED && started && VEIL_ON_PAUSE) veilAs('paused');
    if (state === YT.PlayerState.ENDED) {
      clearInterval(ticker);
      player.destroy();
      finish();
    }
  }

  action.addEventListener('click', () => {
    // A real tap on our own page, which is what Safari wants before it will
    // start an unmuted video. An advert can take a few seconds to arrive, so
    // say so rather than leaving a button that looks like it did nothing.
    if (frame.dataset.veiled === 'cover') {
      action.disabled = true;
      action.textContent = 'Loading';
      veilText.textContent = 'Fetching the video. If an advert comes first, it starts here.';
    }
    playAskedAt = Date.now();
    try { player.playVideo(); } catch {}
  });
}

function errorEl() {
  const el = document.createElement('div');
  el.className = 'mock';
  el.textContent = 'This video will not play here. It may have been made private, or blocked in the UK.';
  return el;
}

async function revealEl(match) {
  const el = document.createElement('p');
  el.className = 'result';
  try {
    if (location.protocol === 'file:' && OFFLINE_SCORES[match.id]) {
      const [h, a] = OFFLINE_SCORES[match.id];
      el.textContent = `${h} – ${a}`;
      return el;
    }
    const res = await fetch(`data/reveal/${match.id}.json`, { cache: 'no-store' });
    const s = await res.json();
    el.textContent = `${s.home} – ${s.away}`;
  } catch {
    el.textContent = 'Score unavailable';
  }
  return el;
}

// Stand-in player for the shipped demo rows.
function mockPlayer(holder, match, finish) {
  holder.className = 'holder mock';
  const label = document.createElement('p');
  label.textContent = 'The real YouTube player appears here.';
  const bar = document.createElement('div');
  bar.className = 'mock-bar';
  const fill = document.createElement('span');
  bar.append(fill);
  holder.append(label, bar);

  let t = 0;
  const tick = setInterval(() => {
    t += 0.25;
    fill.style.width = Math.min(100, (t / match.cutAt) * 100) + '%';
    if (t >= match.cutAt) { clearInterval(tick); finish(); }
  }, 60);

  return tick;
}
