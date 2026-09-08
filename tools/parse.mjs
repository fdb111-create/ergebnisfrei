/* The bit most likely to need fixing: turning a YouTube title into a fixture.
   Kept separate so you can test it without an API key — see test-parse.mjs. */

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
export const EXCLUDE_WORDS = /(u19|u17|u21|frauen|women|top 5|goal of the (month|week|season)|of the season|classic|throwback|preview|press conference)/i;

const SCORE = /(\d{1,2})\s*[-–—:]\s*(\d{1,2})/;
const MATCHDAY = /(?:matchday|spieltag|md)\s*[.:]?\s*(\d{1,2})/i;

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

  const score = title.match(SCORE);
  if (!score) return null;

  // Club names usually sit to the left of the scoreline ("Bayern - Dortmund 2-1"),
  // but some titles put the score in the middle ("Bayern 2-1 Dortmund"), so fall
  // back to scanning the whole title.
  let teams = findClubs(title.slice(0, score.index));
  if (teams.length < 2) teams = findClubs(title);
  if (teams.length < 2) return null;

  const matchday = title.match(MATCHDAY);

  return {
    home: teams[0],
    away: teams[1],
    homeGoals: Number(score[1]),
    awayGoals: Number(score[2]),
    matchday: matchday ? Number(matchday[1]) : null
  };
}

// ISO 8601 duration (PT1M42S) to seconds.
export function toSeconds(iso) {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
