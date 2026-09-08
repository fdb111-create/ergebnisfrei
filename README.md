# Ergebnisfrei

Bundesliga highlights for the UK, with no scoreline in the thumbnail, the title, the page, or even the file the page loads.

The colours live at the top of `styles.css`. The light red version is the default; the original dark green palette is in a comment right underneath it, so you can swap between them by moving six lines.

You do not need to write any code or use a terminal. Everything below is done by clicking things on two websites: Google Cloud and GitHub. Budget about 45 minutes the first time.

---

## Look at it first

Find the file `index.html` and double-click it. It opens in your browser with five demo matches so you can see how the thing behaves. Click **Watch** on one, wait for the bar to fill, then press **Reveal score**.

Two things to notice: no score anywhere, and when the video stops it stops *early*, on purpose. That is the whole trick, and it is explained under "How it avoids spoilers" below.

The demo uses fake matches. The rest of this guide replaces them with real ones.

---

## Step 1 — Get a YouTube key (free, 15 minutes)

A "key" is a long password that lets your site ask YouTube what videos exist. It costs nothing. Google gives you far more daily allowance than this site will ever use.

1. Go to **console.cloud.google.com** and sign in with a Google account.
2. At the top of the page there is a project dropdown. Click it, then **New Project**. Name it `ergebnisfrei`. Click **Create**, then wait a few seconds and make sure the dropdown now shows your new project.
3. In the search bar at the top, type **YouTube Data API v3** and click the result. Click the blue **Enable** button.
4. In the left sidebar click **Credentials**, then **+ Create Credentials** at the top, then **API key**.
5. A box appears with a long string of letters and numbers. Copy it and paste it somewhere safe for a minute. This is your key.
6. Still in that box, click **Edit API key**. Under **API restrictions** choose **Restrict key**, tick **YouTube Data API v3**, and **Save**. This means that if the key ever leaks, it can only be used to read YouTube listings.

Do not put this key in an email, a public document, or the website files. Step 3 shows you where it goes.

---

## Step 2 — Put the site on GitHub

GitHub will store the files, run the hourly update for you, and host the finished site. All free.

1. Go to **github.com** and create an account if you do not have one.
2. Click the **+** in the top right, then **New repository**.
3. Name it `ergebnisfrei`. Set it to **Public** (free hosting requires public). Do not tick any of the "initialize" boxes. Click **Create repository**.
4. On the next page click the link **uploading an existing file**.
5. Open the `ergebnisfrei` folder on your computer, select everything inside it, and drag it onto the GitHub page. Make sure you drag the *contents* of the folder, not the folder itself — GitHub should list `index.html`, `app.js`, `styles.css`, `README.md`, and the `data` and `tools` folders.
6. Scroll down and click **Commit changes**.

Two files may not upload because they start with a dot, which some computers hide: `.nojekyll` and the `.github` folder. If `.github` is missing, the hourly update will not run. Fix it like this: on your repository page click **Add file → Create new file**, and in the filename box type exactly

```
.github/workflows/update.yml
```

then open `update.yml` from your downloaded folder in any text editor, copy everything in it, paste it into the big box on GitHub, and click **Commit changes**. Repeat with a file named `.nojekyll`, leaving the box empty.

---

## Step 3 — Give GitHub your key

1. On your repository, click **Settings** (the tab along the top, not your account settings).
2. In the left sidebar: **Secrets and variables → Actions**.
3. Click **New repository secret**.
4. Name: `YT_API_KEY` — spelled exactly like that, capitals included.
5. Secret: paste your key from Step 1.
6. Click **Add secret**.

The key is now encrypted. Nobody visiting your site can see it, and neither can you after this point.

---

## Step 4 — Let the robot save its work

1. Still in **Settings**, go to **Actions → General** in the left sidebar.
2. Scroll to **Workflow permissions** at the bottom.
3. Select **Read and write permissions**, then **Save**.

Without this, the update runs but cannot save what it found.

---

## Step 5 — Run it once by hand

1. Click the **Actions** tab at the top of your repository.
2. If you see a green button asking you to enable workflows, click it.
3. In the left sidebar click **Update highlights**.
4. On the right, click **Run workflow**, then the green **Run workflow** button.
5. Wait about a minute, then refresh. Click into the run and then into the job to watch it work.

You want to see a line like `Wrote 9 matches to data/videos.json`. If it says `Wrote 0 matches`, jump to Troubleshooting.

---

## Step 6 — Switch the website on

1. **Settings → Pages** in the left sidebar.
2. Under **Source**, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Click **Save**.
4. Wait two or three minutes, then reload the page. An address appears at the top, something like `https://yourname.github.io/ergebnisfrei/`.

That is your site. Open it on your phone too.

From now on it updates itself roughly every hour between 2pm and 11pm UK time. GitHub's timing is approximate and can run late by ten or twenty minutes, which does not matter for highlights.

One quirk worth knowing: GitHub switches off scheduled jobs if nobody touches the repository for 60 days. If your site goes stale over the summer break, open the Actions tab and press **Run workflow** to wake it up.

---

## How it avoids spoilers

There are four places a score can leak, and each is handled differently.

**The thumbnail.** Never loaded. The page draws its own two-colour block with the club's initials instead, and only fetches anything from YouTube when you click Watch. This also means YouTube sets no cookies on your visitors until they choose to play something.

**The video title.** This one is only partly solvable, and you should know that up front. YouTube's title bar lives *inside* the player, and their rules forbid covering any part of an embedded player with your own graphics. So the site does the legal things instead: it starts playing immediately, so the title bar fades within a second or two, and it never shows the title anywhere else. If someone hovers their mouse over a playing video, the bar can reappear. That risk is real and cannot be fully removed without breaking YouTube's terms.

**The end screen.** This one protects the *next* match, not the one you just watched. When a video finishes, YouTube fills the screen with suggested videos, and after Bundesliga highlights those suggestions are more Bundesliga highlights, each with the score across the thumbnail. So the site watches the clock and removes the player about four seconds before the end. You lose a moment of the outro; you avoid being told how Saturday's other five games finished.

**The pause screen.** Pausing produces the same wall of thumbnails. When you pause, the site hides its own player and shows a Resume button. This is the one behaviour that sits in a grey area, since YouTube dislikes anything that obscures the player, even your own copy of it. If you would rather not do it, open `app.js`, and on line 6 change `true` to `false`.

And the score itself never reaches your visitor's browser at all. It lives in its own tiny file that is only downloaded if someone presses Reveal score.

---

## Troubleshooting

**"Wrote 0 matches" in the update log.** Scroll to the bottom of the log. It prints any titles it recognised as highlights but could not read, with the digits replaced by x so reading the log does not spoil you. Almost always the fix is a club name spelling that isn't in the list. Open `tools/clubs.json` on GitHub, click the pencil icon, and add the missing spelling to that club's `aliases` list.

**A newly promoted club is missing.** Same file. Copy an existing block, change the name, abbreviation, colours and aliases.

**The site loads but says "Nothing to show yet".** The update job has not saved anything yet. Check Step 4 was done, then re-run the job.

**A match shows but will not play.** Some Bundesliga videos are blocked in the UK. The ingest script already filters those out, but blocks can be added after the fact. Nothing to fix; the video will drop off the list at the next update.

**Everything looks unstyled.** The `.nojekyll` file did not upload. See the end of Step 2.

**I want my own domain name.** Buy one (about £10 a year from Namecheap or Gandi), then in **Settings → Pages** enter it under Custom domain and follow the instructions it gives you.

---

## If you want to change things

The files, in plain terms:

| File | What it does |
| --- | --- |
| `index.html` | The words and structure of the page |
| `styles.css` | Colours, type, spacing |
| `app.js` | The player behaviour and the spoiler rules |
| `tools/ingest.mjs` | The hourly job that reads YouTube and strips the scores |
| `tools/parse.mjs` | Turns a YouTube title into a fixture. The part most likely to need fixing |
| `tools/clubs.json` | Club names, abbreviations and colours |
| `.github/workflows/update.yml` | The schedule |

To edit any of them, click the file on GitHub and then the pencil icon. Changes go live a minute after you save.

If you get stuck on the parser, this is the point to open the folder in Claude Code, since it can run `node tools/test-parse.mjs` against real titles and fix the pattern for you.

---

## Two things to keep in mind

The club colours here are stand-ins for badges on purpose. Club crests are trademarked, and a site that reproduces eighteen of them is a different legal proposition from one that uses two squares of colour.

Keep the site free and unmonetised. Embedding official highlights is what the YouTube player is for, but selling advertising around someone else's football rights is how a fun project turns into a letter from the DFL.
