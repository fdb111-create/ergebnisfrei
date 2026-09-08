/**
 * Ergebnisfrei — ingest
 *
 * Reads the official Bundesliga YouTube uploads, works out which video belongs
 * to which fixture, and writes TWO separate things:
 *
 *   data/videos.json          <- no scores anywhere. This is what the website loads.
 *   data/reveal/<id>.json     <- the score on its own, one tiny file per match,
 *                                only fetched when someone presses "Reveal score".
 *
 * The score never travels to the browser unless the visitor asks for it.
 *
 * Runs on GitHub Actions. Needs Node 18 or newer (Actions already has it).
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTitle, toSeconds, HIGHLIGHT_WORDS, EXCLUDE_WORDS } from './parse.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'data');
const REVEAL = join(DATA, 'reveal');

// ---------------------------------------------------------------- settings --

const API_KEY = process.env.YT_API_KEY;
const CHANNEL_HANDLE = process.env.YT_CHANNEL_HANDLE || '@bundesliga';
const CHANNEL_ID = process.env.YT_CHANNEL_ID || '';
const REGION = (process.env.REGION || 'GB').toUpperCase();
const DAYS = Number(process.env.DAYS || 21);
const MAX_PAGES = Number(process.env.MAX_PAGES || 4); // 4 pages = up to 200 uploads
const INCLUDE_BL2 = process.env.INCLUDE_BL2 === 'true'; // set true to add 2. Bundesliga

if (!API_KEY) {
  console.error('\nNo YT_API_KEY found.');
  console.error('On GitHub: Settings > Secrets and variables > Actions > New repository secret.\n');
  process.exit(1);
}

// --------------------------------------------------------------- API calls --

const API = 'https://www.googleapis.com/youtube/v3';

async function yt(endpoint, params) {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${endpoint} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res.json();
}

async function findUploadsPlaylist() {
  const params = CHANNEL_ID
    ? { part: 'contentDetails,snippet', id: CHANNEL_ID }
    : { part: 'contentDetails,snippet', forHandle: CHANNEL_HANDLE };

  const data = await yt('channels', params);
  const channel = data.items?.[0];
  if (!channel) {
    throw new Error(`No channel found for ${CHANNEL_ID || CHANNEL_HANDLE}. Check the handle spelling.`);
  }
  console.log(`Channel: ${channel.snippet.title}`);
  return channel.contentDetails.relatedPlaylists.uploads;
}

async function listUploads(playlistId) {
  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const items = [];
  let pageToken = '';

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {})
    });

    for (const item of data.items || []) {
      const publishedAt = item.contentDetails.videoPublishedAt || item.snippet.publishedAt;
      if (new Date(publishedAt).getTime() < cutoff) return items; // uploads are newest-first
      items.push({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        publishedAt
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

async function fetchDetails(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt('videos', {
      part: 'contentDetails,status',
      id: ids.slice(i, i + 50).join(',')
    });
    for (const v of data.items || []) out.set(v.id, v);
  }
  return out;
}

// Is this video actually watchable in the UK, and can we embed it?
function playableHere(video) {
  if (video.status?.embeddable === false) return false;
  if (video.status?.privacyStatus !== 'public') return false;

  const r = video.contentDetails?.regionRestriction;
  if (!r) return true;
  if (r.allowed && !r.allowed.includes(REGION)) return false;
  if (r.blocked && r.blocked.includes(REGION)) return false;
  return true;
}

// -------------------------------------------------------------------- main --

const playlistId = await findUploadsPlaylist();
const uploads = await listUploads(playlistId);
console.log(`Looked at ${uploads.length} uploads from the last ${DAYS} days.`);

const candidates = [];
const rejected = [];

for (const upload of uploads) {
  const parsed = parseTitle(upload.title);
  if (parsed) candidates.push({ ...upload, ...parsed });
  else if (HIGHLIGHT_WORDS.test(upload.title) && !EXCLUDE_WORDS.test(upload.title)) {
    rejected.push(upload.title);
  }
}

const details = await fetchDetails(candidates.map((c) => c.id));

const matches = [];
const reveals = [];
let blocked = 0;
let tierSkipped = 0;

for (const c of candidates) {
  const video = details.get(c.id);
  if (!video) continue;
  if (!playableHere(video)) { blocked++; continue; }
  if (c.secondTier && !INCLUDE_BL2) { tierSkipped++; continue; }

  const duration = toSeconds(video.contentDetails.duration);
  if (duration < 45) continue; // shorts and teasers

  matches.push({
    id: c.id,
    publishedAt: c.publishedAt,
    matchday: c.matchday,
    secondTier: c.secondTier,
    hasScore: c.homeGoals !== null,
    duration,
    // Stop the player this many seconds early so YouTube's end screen —
    // which is a wall of thumbnails with scores on them — never appears.
    cutAt: Math.max(1, duration - 4),
    home: { abbr: c.home.abbr, short: c.home.short, name: c.home.name, primary: c.home.primary, secondary: c.home.secondary },
    away: { abbr: c.away.abbr, short: c.away.short, name: c.away.name, primary: c.away.primary, secondary: c.away.secondary }
  });

  if (c.homeGoals !== null) reveals.push({ id: c.id, homeGoals: c.homeGoals, awayGoals: c.awayGoals });
}

matches.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

await mkdir(DATA, { recursive: true });
await rm(REVEAL, { recursive: true, force: true });
await mkdir(REVEAL, { recursive: true });

await writeFile(
  join(DATA, 'videos.json'),
  JSON.stringify({ region: REGION, updatedAt: new Date().toISOString(), matches }, null, 2)
);

for (const r of reveals) {
  await writeFile(
    join(REVEAL, `${r.id}.json`),
    JSON.stringify({ home: r.homeGoals, away: r.awayGoals })
  );
}

console.log(`\nWrote ${matches.length} matches to data/videos.json`);
if (blocked) console.log(`Skipped ${blocked} not playable in ${REGION}.`);
if (tierSkipped) console.log(`Skipped ${tierSkipped} from 2. Bundesliga (set INCLUDE_BL2 to include them).`);

if (rejected.length) {
  console.log(`\n${rejected.length} video(s) looked like highlights but could not be read.`);
  console.log('If matches are missing from your site, these titles are why:');
  // Scores are masked so reading the build log does not spoil you.
  for (const t of rejected) console.log('  ' + t.replace(/\d/g, 'x'));
}
