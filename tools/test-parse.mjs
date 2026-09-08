/* Checks the title parser against a set of title formats.
   Run it with:  node tools/test-parse.mjs
   No API key needed. Add any title that your site missed to the list below. */

import { parseTitle } from './parse.mjs';

const titles = [
  'FC Bayern München - Borussia Dortmund 2-1 | Highlights | Matchday 4 – Bundesliga 2025/26',
  'RB Leipzig – 1. FC Union Berlin 3:0 | Highlights | Matchday 12',
  'Bayer 04 Leverkusen vs. SC Freiburg 0-0 | Highlights | Bundesliga',
  'Borussia Mönchengladbach - VfB Stuttgart 1-4 | Highlights | Matchday 7',
  'FC St. Pauli - Eintracht Frankfurt 3-1 | Highlights | Spieltag 5',
  '1. FC Heidenheim 1846 - TSG 1899 Hoffenheim 2-2 | Highlights',
  'Hamburger SV - 1. FC Köln 2-4 | Highlights | Matchday 2',
  'Werder Bremen - FC Augsburg 1-0 | Alle Tore | 3. Spieltag',
  // These should all be ignored:
  'Top 5 Goals of Matchday 4 | Bundesliga',
  'Harry Kane: every goal of the season so far | Bundesliga',
  'Bayern München press conference before Matchday 9',
  'Behind the scenes at Signal Iduna Park'
];

let pass = 0;
let fail = 0;

for (const title of titles) {
  const r = parseTitle(title);
  const shouldParse = /\d\s*[-–—:]\s*\d/.test(title) && /highlights|alle tore/i.test(title) && !/top 5|of the season|press conference/i.test(title);

  if (shouldParse && r) {
    console.log(`ok    ${r.home.short} v ${r.away.short}  (matchday ${r.matchday ?? '?'})`);
    pass++;
  } else if (!shouldParse && !r) {
    console.log(`ok    ignored: ${title.slice(0, 45)}…`);
    pass++;
  } else {
    console.log(`FAIL  ${title}`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exitCode = 1;
