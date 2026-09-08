/* Ergebnisfrei — front end.
   Everything here runs in the visitor's browser. It never sees a score
   until someone presses "Reveal score". */

// Hide the player while it is paused, because YouTube fills a paused player
// with related-video thumbnails that carry scorelines. Set this to false if
// you would rather not hide any part of the player at all — see README.
const VEIL_ON_PAUSE = true;

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

  row.addEventListener('click', () => {
    if (wrap.dataset.open === 'true') return;
    wrap.dataset.open = 'true';
    row.setAttribute('aria-expanded', 'true');
    play.textContent = 'Playing';
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
  veilText.textContent = 'Paused. The player is hidden while it waits, because YouTube fills a paused video with other matches and their scores.';
  const resume = document.createElement('button');
  resume.className = 'btn';
  resume.type = 'button';
  resume.textContent = 'Resume';
  veil.append(veilText, resume);

  frame.append(holder, veil);

  const after = document.createElement('div');
  after.className = 'after';
  const done = document.createElement('p');
  done.textContent = 'Stopped early, so YouTube could not suggest other matches.';
  const revealBtn = document.createElement('button');
  revealBtn.className = 'btn btn--quiet';
  revealBtn.type = 'button';
  revealBtn.textContent = 'Reveal score';
  after.append(done, revealBtn);

  stage.append(frame, after);

  revealBtn.addEventListener('click', async () => {
    revealBtn.replaceWith(await revealEl(match));
  });

  const finish = () => {
    stage.dataset.finished = 'true';
    stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  if (match.id.startsWith('DEMO')) return mockPlayer(holder, match, finish);

  await loadApi();

  let watcher;
  const player = new YT.Player(holder, {
    videoId: match.id,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
      origin: location.origin
    },
    events: {
      onReady: (e) => e.target.playVideo(),
      onError: () => {
        clearInterval(watcher);
        frame.replaceChildren(errorEl());
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          frame.dataset.veiled = 'false';
          clearInterval(watcher);
          // Pull the player before YouTube's end screen of scored thumbnails.
          watcher = setInterval(() => {
            if (player.getCurrentTime() >= match.cutAt) {
              clearInterval(watcher);
              player.destroy();
              finish();
            }
          }, 250);
        }

        if (e.data === YT.PlayerState.PAUSED && VEIL_ON_PAUSE) {
          frame.dataset.veiled = 'true';
        }

        if (e.data === YT.PlayerState.ENDED) {
          clearInterval(watcher);
          player.destroy();
          finish();
        }
      }
    }
  });

  resume.addEventListener('click', () => {
    frame.dataset.veiled = 'false';
    player.playVideo();
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

// Stand-in player for the shipped demo rows. Deleted once you have real data.
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
}
