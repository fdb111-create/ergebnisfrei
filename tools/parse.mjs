/* Turns a YouTube title into a fixture.

   Real Bundesliga titles look like:
     On Top of the League | EINTRACHT FRANKFURT - FC AUGSBURG | Highlights | Matchday 3 - Bundesliga
     GREUTHER FÜRTH - HEIDENHEIM | Highlights | Matchday 4 - Bundesliga 2 2026/27

   Note there is no scoreline in them. The clubs sit in their own segment
   between pipes, and the headline before it often gives the game away in
   words ("Comeback Complete!"), which is why the site never displays it. */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export const clubs = JSON.parse(await readFile(join(HERE, 'clubs.json'), 'utf8'));

// Longest aliases first, so "Bayern München" wins over "Bayern".
const aliasIndex = clubs
  .flatMap((club) => club.aliases.map((alias) => ({ alias, club })))
  .sort((a, b) => b.alias.length - a.alias.length);

export const HIGHLIGHT_WORDS = /(highlights|zusammenfassung|all goals|alle tore)/i;
export const EXCLUDE_WORDS = /(u19|u17|u21|frauen|women|top \d|goal of the (month|week|season)|of the season|classic|throwback|preview|press conference|all highlights|every goal)/i;

const SCORE = /(\d{1,2})\s*[-–—:]\s*(\d{1,2})/;
const MATCHDAY = /(?:matchday|spieltag|md)\s*[.:]?\s*(\d{1,2})/i;
// The 2 must not be the start of a season number, or 'Bundesliga 2026/27' matches.
const SECOND_TIER = /(bundesliga\s*2(?!\d)|2\.\s*bundesliga|2\.\s*liga)/i;

function findClubs(text) {
  const found = [];
  const taken = [];
  const lower = text.toLowerCase();

  for (const { alias, club } of aliasIndex) {
    const at = lower.indexOf(alias.toLowerCase());
    if (at === -1) continue;
    const end = at + alias.length;
    if (taken.some(([s, e]) => at < e && end > s)) continue;
    if (found.some((f) => f.club.abbr === club.abbr)) continue;
    taken.push([at, end]);
    found.push({ club, at });
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.club);
}

export function parseTitle(title) {
  if (!HIGHLIGHT_WORDS.test(title)) return null;
  if (EXCLUDE_WORDS.test(title)) return null;

  // Work segment by segment. The fixture lives in whichever piece names two
  // clubs, which keeps a headline like "Elversberg Do It AGAIN!" from
  // reversing home and away.
  let teams = [];
  for (const segment of title.split('|')) {
    const inSegment = findClubs(segment);
    if (inSegment.length >= 2) { teams = inSegment; break; }
  }
  if (teams.length < 2) teams = findClubs(title);
  if (teams.length < 2) return null;

  const matchday = title.match(MATCHDAY);
  const score = title.match(SCORE);

  return {
    home: teams[0],
    away: teams[1],
    matchday: matchday ? Number(matchday[1]) : null,
    secondTier: SECOND_TIER.test(title),
    // Usually absent. Kept in case the channel ever puts scores back in titles.
    homeGoals: score ? Number(score[1]) : null,
    awayGoals: score ? Number(score[2]) : null
  };
}

// ISO 8601 duration (PT1M42S) to seconds.
export function toSeconds(iso) {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
