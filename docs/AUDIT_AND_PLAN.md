# Who When Where — Audit and Plan

*Phase 1 deliverable, 11 Nov 2026. No app code was changed for this document.*

**Goal set by the owner:** make the site look and feel much more like [geocore.fun](https://www.geocore.fun) (a polished hub of many geography/trivia games), make it more social, add **many** more games, and prepare for a subscription later.

**How this was produced**
- The whole repository was read: `app/`, `components/`, `games/` (6 games), `lib/`, `social/`, `party/`, `expedition/`, `account/`, `logbook/`, `api/` (src, tests, deploy), `scripts/`, `public/`.
- The live site (`who-when-where.vercel.app`) was screenshotted at 1440×900 and 390×844, light and dark, signed out. Four games were played to the end.
- A local production build plus a scratch API was used to screenshot the signed-in social screens: community, leaderboard, player, party room and race.
- geocore.fun was studied through its sitemaps (111 `/play/*` games, 87 catalogue entries), its pricing FAQ (JSON-LD), its compiled CSS tokens, and headless screenshots of home, play hub, daily, leaderboards and pricing.

References like `file.ts:12` point at the current code.

---

## Contents

1. [What exists today](#1-what-exists-today)
2. [UI/UX audit](#2-uiux-audit)
3. [What geocore.fun does](#3-what-geocorefun-does)
4. [Design system proposal (Tailwind v4)](#4-design-system-proposal-tailwind-v4)
5. [New games (20)](#5-new-games)
6. [Social features](#6-social-features)
7. [Monetization-ready architecture](#7-monetization-ready-architecture)
8. [Implementation roadmap](#8-implementation-roadmap)
9. [Summary: top 10 problems and the phases](#9-summary)

---

## 1. What exists today

### 1.1 Stack
- **Front end:** Next 16.4 (App Router, `cacheComponents`, `partialPrefetching`) and React 19.3.
- **Styling:** Tailwind 4.3 is imported, but **not one utility class is used**. All styling is about 5,000 lines of hand-written global CSS (`globals.css` 2,421, `social.css` 1,579, `logbook.css` 562, `flow.css` 278, `atlas.css` 170). All of it loads on every page.
- **Map:** d3-geo, d3-zoom, topojson.
- **API:** a separate Hono + SQLite (`node:sqlite`, WAL) service on a VPS, reached through a Next rewrite at `/api/*`.
- **Data:** offline scripts build rosters from Wikipedia and Wikidata, plus Natural Earth geometry.

### 1.2 Games

| Game | Mechanic | Roster | Tries | Scoring (0–1000) |
|---|---|---|---|---|
| **Who When Where** `/who-when-where` | A famous person: pin birth place, set birth year, pin death place, set death year | 50 people (`people.json`, 105 KB) | 4 rounds | 250 per round. Place: full marks within 20 km, then `exp(-(km-20)/1100)`. Year: `exp(-Δ/28)` |
| **Wayfarer** `/wayfarer` | A famous journey's route is drawn a stretch at a time; name the journey | 40 journeys (123 KB) | 6, with skip | Points by guesses used; clues unlock at guesses 2, 3 and 4 |
| **Dig Site** `/dig-site` | Photo plus clue of a lost city; each dig draws a distance ring | 69 playable sites (120 KB) | 5 digs | Points by digs used; a miss earns up to 150 by closest dig |
| **First to Last** `/first-to-last` | 6 events pinned on the map; put them in chronological order | 149 events, 21-day cycle | 3 attempts | Points by attempts; a loss earns 25 per event in place |
| **Overland** `/overland` | Two countries; name the countries that connect them | 158 bordered countries (6,762 pairs) | shortest route + 4 | Points fall with each wasted guess |
| **Outline** `/outline` | A country silhouette; misses give distance, direction and "% there" | 172 countries | 6 | Points by guesses used |

**How a puzzle is chosen and stored**
- The daily puzzle is picked **on the device** from the **local date**: day 1 is 10 Nov 2026 (`lib/daily.ts`), with a shuffled cycle per game.
- Saves live in `localStorage` under `www:<slug>:v1`.
- Each game exports `SYNC` so signed-in players' saves follow them across devices.

### 1.3 Around the games
- **Hub `/`:**
  - A "daily challenge": 6/6 games, points, local streak, level bar, a one-tap share of the whole day, and a 53-week activity graph.
  - Six game cards.
  - Four "play together" cards.
  - First-time guests are redirected from `/` to `/who-when-where` (`lib/entry.ts`).
- **Logbook `/logbook`:** level (XP is total daily points), 21 achievements, and an "atlas" of everything revealed. It is **local only**.
- **Expedition `/expedition`:**
  - A custom run of puzzles from any game, with round counts, order, a clock and difficulty.
  - Played solo, with a `?c=` challenge link.
- **Party `/party`:** rooms of up to 12, joined by code, invitation or the public list. Live standings and chat work by **polling** (every 2.5 s). The server stores a seed and every client deals the same puzzles.
- **Leaderboard `/leaderboard`:** day, 7 days or all time; one game or all; everyone or friends. Top 50 plus your own rank.
- **Community `/community`:** friends (search, requests, presence, today's score), a global chat and DMs.
- **Player `/player?u=`:** a public profile (totals, streaks, activity graph, per-game averages).
- **Account `/account`:**
  - E-mail, password and username. Settings for avatar colour, names, language, e-mail, password, and delete.
  - Sessions are HttpOnly cookies holding a hashed token. Passwords use scrypt.
  - **No** password reset and **no** e-mail verification.

### 1.4 Data sources and licences

| Data | Source | Licence | Notes |
|---|---|---|---|
| People, journeys, sites (facts) | Wikidata | CC0 | Fine for commercial use |
| Extracts shown in game | Wikipedia | CC BY-SA 4.0 | Needs attribution and share-alike of the text. Credit is a single footer line |
| Portraits and site photos | Wikimedia Commons | **Per file** (PD, CC BY, CC BY-SA) | ⚠️ `people.json` and `sites.json` store no author or licence, so per-image attribution is missing. Fix before charging money |
| World map | Natural Earth via `world-atlas` | Public domain | 756 KB TopoJSON, including an unused `land` object |

---

## 2. UI/UX audit

Severity: 🔴 high · 🟠 medium · 🟡 low.

### 2.1 Global shell (every page)

| # | Problem | Where | Sev |
|---|---|---|---|
| G1 | **The header is 4–6 unlabelled round icons** (logbook, community, account, settings, plus help and stats on games). They are hard to tell apart, change from page to page, and are 34 px (below the 44 px target). There is no main navigation: no "Play", "Leaderboards" or "Daily" | `components/site-header.tsx`, `globals.css:213` | 🔴 |
| G2 | **The site defaults to Portuguese and ignores the browser language.** It server-renders PT and then flips to EN for players who chose English, which causes a flash. `<html lang="pt-BR">` is fixed while every page title and description is English only. The language switch is buried in Settings | `lib/i18n.ts:12`, `app/layout.tsx:50` | 🔴 |
| G3 | **First-time visitors to `/` are redirected to `/who-when-where`.** That includes people opening a shared hub link and the installed PWA. Newcomers never see the catalogue, which is the opposite of geocore's "hub first" | `lib/entry.ts` | 🟠 |
| G4 | **Contrast failures.** `--ink-3 #91866f` on paper is **2.95:1**. It is used for footer text, form hints, ranks, chat timestamps and locked badges, all at 9–11 px mono. Vermilion `#c8412b` on paper is 4.05:1 and is used for tiny labels ("JOGAR →"). Heat colours as text are 2.7–3.1:1. Dark `--ink-3` is 3.05:1 | `globals.css` tokens | 🔴 |
| G5 | **Typography is too small.** UI labels are 0.56–0.7 rem uppercase mono everywhere: eyebrows, chips, hints, badges, stat captions | many | 🟠 |
| G6 | **Fonts cost about 494 KB per page.** Fraunces is loaded as latin + latin-ext × normal + italic with the SOFT, WONK and opsz axes, yet `body` pins `WONK 0` | `app/layout.tsx:13` | 🟠 |
| G7 | **The paper-grain overlay** is a `position:fixed; z-index:40` layer with `mix-blend-mode` over everything. That forces a composite layer and can cause scroll jank on low-end phones | `globals.css` `body::before` | 🟡 |
| G8 | **No error boundary** (`app/error.tsx` or `global-error`). A malformed save from an old version or from sync crashes the whole page | `app/` | 🔴 |
| G9 | **Dark mode looks wrong.** Hard offset shadows become cream (`5px 5px 0 #ece4d2`), which glares like a print misregistration. Primary buttons become cream blocks, and the disabled button is a dark slab with dark text | `globals.css` | 🟠 |
| G10 | **Content widths differ by page:** Community and Party are about 1100 px, Leaderboard, Player and Expedition 680 px, Account 420 px. **The social sub-nav jumps sideways** when you switch tabs | `social.css` | 🟠 |
| G11 | **Footer layout shift** once client content mounts (CLS 0.06 on Logbook, 0.027 on Expedition) | page shells | 🟡 |
| G12 | **No legal pages:** no terms, privacy (LGPD/GDPR) or cookie notice | `app/` | 🟠 (🔴 before payments) |
| G13 | **The "W·W·W" logo's `aria-label` is English only**, and the hub's `<h1 aria-label>` hides the localized subtitles from screen readers | `site-header.tsx:11`, `app/page.tsx:24` | 🟡 |

### 2.2 Hub `/`
- **Not a catalogue.** Six tall text-only cards with no thumbnails, no categories, no filtering and no search. The mobile hub is 3,881 px tall. This structure won't scale beyond about 10 games. 🔴
- **Daily challenge panel:**
  - The stats row is unevenly spaced, and on mobile its labels wrap to 2–3 lines ("MAIOR SEQUÊNCIA").
  - Checklist scores ("66", "2") have no unit.
  - The streak number is vermilion, a colour that means "your guess/miss" elsewhere. 🟡
- **Activity graph:** it starts about 60 px from the card edge on desktop and shows only Jul–Nov on mobile. Per-day details are only in `title` tooltips inside an `aria-hidden` block, so they are unreachable by touch, keyboard and screen reader (`social/activity-graph.tsx:48,78`). 🟠
- **"Play together" cards:**
  - Footers wrap so the "ABRIR →" arrow drops onto its own line.
  - Their order (Expedition, Party, Ranking, Community) is the reverse of the social tabs' order.
  - Expedition is a solo mode listed under "together". 🟡

### 2.3 Game screens (shared problems)

| # | Problem | Where | Sev |
|---|---|---|---|
| P1 | **Playing a pin needs a mouse or touch.** Place rounds in Who When Where and all of Dig Site can't be played by keyboard or screen reader. Map pins are `role="button"` inside an `svg role="img"`, so assistive technology ignores them | `world-map.tsx:324,434,476` | 🔴 |
| P2 | **On mobile the primary action is below the fold.** Dig Site's "Cavar aqui" sits at about y=840 on a 390×844 screen, and Wayfarer's list pushes "Chutar" off-screen, so every move needs a scroll | Dig Site, Wayfarer | 🔴 |
| P3 | **The map traps page scrolling.** `.map-frame { touch-action:none }` at 50 svh means half the screen can't scroll the page | `globals.css:699` | 🟠 |
| P4 | **Any resize resets the map** (for example rotating the phone), throwing away the player's pan and zoom | `world-map.tsx:239-277` | 🟡 |
| P5 | **The map frame is a rectangle but the projection has curved edges**, leaving about 60 px of empty paper above and below the world on mobile. First to Last uses a different, cropped view: Asia and Australia are cut off on mobile | map CSS | 🟠 |
| P6 | **Result maps push the player's own guesses off the frame.** The view zooms to the answer, so the guess pins and dotted lines run off the edge. That is the emotional payoff of the game, and it's hidden. Dig Site's mobile result shows only 2 of 5 digs | result views | 🔴 |
| P7 | **Every game's loading skeleton is Who When Where's portrait layout**, so other games jump when they load | `components/daily.tsx:28` | 🟡 |
| P8 | **Game pages are client-only** (`use(browser(...))`). The static HTML is a skeleton, so LCP waits for JS and hydration, and there is no game content for search engines | `components/daily.tsx:24` | 🟠 |
| P9 | **Help is text only.** There is no diagram or animated example. The help dialog's autofocused close button shows a vermilion ring that reads like an error | `game-panels.tsx` | 🟡 |
| P10 | **Inconsistencies between games:**<br>- **Result screens** are ordered differently in all six (score, map, share, Wikipedia, facts).<br>- **Hub status units** differ: Who When Where shows "750/1,000", the others "3/6", and Overland's denominator changes daily.<br>- **"Streak"** counts any finished day in Who When Where but only solved days in the other five.<br>- **Skip** exists only in Wayfarer, and no game has give-up.<br>- **Pickers:** Wayfarer has its own, the rest use `CountryPicker` | see games | 🟠 |
| P11 | **Rules text hard-codes the number of tries** ("Name it in six"). That is wrong in expeditions with 3–5 tries, and clues "after guess 4" then never open | `wayfarer/messages.ts:10`, `outline/game.tsx:165` | 🟠 |
| P12 | **Colour-only signals.** The hit/miss/near/skip meters are empty `<li>`s told apart by colour. Outline's direction arrow is `aria-hidden` and is the only place the direction appears. Wayfarer's wrong-guess hint isn't announced | `outline/game.tsx:246`, `wayfarer/game.tsx:300` | 🟠 |
| P13 | **Dialogs have no accessible name** (`aria-labelledby`). Focus falls to `<body>` after "Next question". Map fly-to animations ignore `prefers-reduced-motion` | `modal.tsx`, `place-round.tsx:77`, `world-map.tsx:307` | 🟠 |

### 2.4 Game-specific problems
- **Who When Where**
  - The year dial starts at 1700 and "Lock in" is enabled before the player touches it, so a stray tap submits 1700 (`year-round.tsx:21,68`). 🟠
  - A typed year only commits on blur or Enter, so it may be dropped if the button doesn't take focus (likely on iOS Safari). 🟠
  - **There is no BC support** in the input, the ruler labels or `formatYear`. This doesn't bite today, but it blocks adding ancient people. 🟡
  - Bios include **Wikipedia hatnotes** ("Este artigo é sobre o cientista… Para o processo… veja pasteurização."). 🟠
  - Reloading during a reveal skips it. 🟡
- **Dig Site:** **the image file name gives the answer away** (`/sites/petra.jpg`; long-press, then open image). 🟠 On mobile the dig-strip numbers collide with the cell borders. 🟡
- **Wayfarer**
  - The whole journey list shows before any typing, and it clips mid-row.
  - The zoom stack covers a third of the 260 px mobile map.
  - "Whose journey is this?" is asked even for journeys that aren't one person's.
  - Enter only submits when exactly one journey matches. 🟡
- **First to Last:** an achievement toast lands over the event list. The list narrows on the result screen, a visible jump. 🟡
- **Overland:** endpoint labels look muddy in dark mode. "Arrived through {n} countries" also counts wasted guesses. 🟡
- **Outline:** the guess list relies on heat colours that fail contrast. The curved "TENTATIVAS" text on the result stamp is clipped. 🟡

### 2.5 Shared components
- **`CountryPicker`**
  - It truncates to 8 matches *before* removing countries already guessed, so valid matches can disappear (`country-picker.tsx:29-30`). 🟠
  - Enter submits the first match even after one letter, which wastes a guess. 🟠
  - It has no combobox/listbox semantics. 🟡
- **Help/Stats panel state is a module-global variable** (`lib/ui.ts:10`). If you leave a page with Stats open, Stats reopens on the next game. 🟡
- **Save mixing.** When the saved day's roster item no longer exists, five of the six games append the new move to the old record (`who-when-where/game.tsx:31`, `wayfarer/game.tsx:46`, `dig-site/game.tsx:33`, `outline/game.tsx:40`, `first-to-last/game.tsx:28`). Only Overland does this right. 🟠
- **When storage is full, writes go to memory while reads still come from `localStorage`**, so moves silently don't stick (`lib/storage.ts:14-28`). 🟡
- **Midnight rollover** replaces an unfinished puzzle mid-play (`<Play key={day}>`), with no way back to finish yesterday's. 🟠
- **`next/image priority` is deprecated in Next 16** in favour of `preload` (`dossier.tsx:35`, `dig-site/game.tsx:130`). 🟡

### 2.6 Social, account, party, expedition

| # | Problem | Where | Sev |
|---|---|---|---|
| S1 | **Challenge links do nothing for anyone who has finished an expedition before.** The stored finished run renders the summary branch, and the challenge is ignored | `expedition/solo.tsx:96` | 🔴 |
| S2 | **The host can wipe a live race.** "Play again" and "Back to lobby" show for a host who has finished while others are still playing, with no confirm. The server's `/start` accepts a mid-run call | `party/room.tsx:306`, `api/src/parties.ts:291` | 🔴 |
| S3 | **"Everyone done" treats away players as done.** A hidden tab stops polling, the player becomes "away" after 15 s, and final standings show while they're still playing. "Together" pace skips them the same way | `room.tsx:287,227` | 🟠 |
| S4 | **No host migration while the host's tab is closed.** Nobody can start, release a stage or kick, and "together" pace blocks on an AFK host | `parties.ts:354` | 🟠 |
| S5 | **A kicked player can rejoin with one click** ("Try again" calls join). Opening a party link joins immediately with no confirm | `room.tsx:74,193` | 🟠 |
| S6 | **Party room chat overflows its card:** the log and the "ENVIAR" button stick out past the right border. The lobby settings column is very long, with "Começar o jogo" at the very bottom | `social.css` party grid | 🟠 |
| S7 | **"/4" is hard-coded for a 6-game day** in the friend row ("Today: N pts · 3/4") | `social/messages.ts:98,359` | 🟠 |
| S8 | **The API being down looks like being signed out.** Social pages show a sign-up form instead of "service unavailable". The `unavailable` error code has no message. A 401 during polling doesn't sign out | `account/state.ts:77`, `social/remote.ts:38` | 🟠 |
| S9 | **Sign-out can lose progress.** If the final push fails, the error is swallowed and the device's games are wiped anyway | `account/state.ts:156` | 🟠 |
| S10 | **An unread DM badge that never clears**, from someone since unfriended: the DM endpoint returns 403 so it can't be marked read | `social.ts:291`, `chat.ts:94` | 🟡 |
| S11 | **Streaks are computed three ways:** per game (two different rules), the hub's local streak (`lib/stats.ts`), and the server's lenient UTC−12 rule (`api/src/days.ts`). The hub and the public profile can disagree | — | 🟠 |
| S12 | **Navigation**<br>- The social tabs are Community, Leaderboard, Party, Expedition. Expedition is solo, while Logbook and "My profile" aren't tabs.<br>- DMs have **no inbox**; they open only from a friend row.<br>- "Friends ×" and "Requested ×" look like status labels but are destructive buttons | `social/tabs.tsx`, `community.tsx:93`, `friends.tsx:78` | 🟠 |
| S13 | **Signed-out Party and Community show only a sign-up card**, with nothing showing what the feature is like. `/account` instead shows an unboxed sign-in form, so the two entry points differ. The header avatar shows the **e-mail** as its title | `social/gate.tsx`, `account-button.tsx:12` | 🟠 |
| S14 | **Logbook, levels and achievements are device-only.** Expedition and party play earn nothing | `logbook/` | 🟠 |
| S15 | **The chat log is `aria-live` on the whole list**, so screen readers announce the 60-message backlog and every poll. Presence is colour only. The party drawer isn't a dialog (no focus trap, no Esc) and covers controls on phones | `chat.tsx:76`, `avatar.tsx:19`, `room.tsx:529` | 🟠 |
| S16 | **Ambiguous presence and actions.** The online dot uses a green (`#3fa34d`) outside the palette. Kick and remove use `window.confirm` or no confirm at all | — | 🟡 |

### 2.7 Security, abuse and integrity (these affect UX and monetization)
- **Rate limiting probably collapses into one bucket for the whole site.** The API trusts the *last* `X-Forwarded-For` hop (`api/src/app.ts:55`). Behind the Vercel rewrite plus Caddy, that is likely a proxy address, not the player's. If so, 20 sign-ups/hour and 60 logins/15 min would apply to everyone combined. This must be checked in production. 🔴
- **No rate limit on `/parties/join`** (party codes can be brute-forced: 31⁵ ≈ 28.6 M), `/leaderboard`, `/players/:u` or username changes. 🟠
- **No moderation tools:** no block, report, mute, word filter, admin role or ban, yet there is a global chat, public parties and open friend requests. 🔴 (before growth)
- **No e-mail verification, no password reset.** Sign-up reveals whether an e-mail is registered, and anyone can lock an account by failing 10 logins. 🔴 (before payments)
- **Scores are taken on trust; all answers ship in the bundle; the day comes from the device clock.** Leaderboards can be faked, future puzzles can be previewed, and **nothing can be put behind a paywall on the server today** (see §7). 🔴 (for monetization)
- **Public profiles expose online status and full activity to anonymous visitors.** There is no private-profile or hide-presence option. 🟡

### 2.8 Performance
- **Transferred bytes on a cold load:** hub ≈ 1.05 MB, game pages ≈ 1.23–1.26 MB. About **494 KB is fonts**, about 242 KB (gzipped) is the world TopoJSON on every map page, and JS is about 230–350 KB gzipped per route.
- **The root layout's `<Celebrations>` imports every game's store and rules** (`logbook/watcher.tsx`). The hub registry imports every `status.tsx`, and the expedition imports every board and roster. **Every new game makes every page heavier.** There is no `next/dynamic` anywhere.
- **Every roster ships whole**, with both languages' Wikipedia extracts, even though a day needs one item.
- **The map re-renders every marker, label and route interpolation on each pan or zoom frame.** Only the base map is memoized.
- **Polling cost:** pulse every 20 s on every page, chat every 3 s, party every 2.5 s. 1,000 users on Community is about 470 req/s through Vercel → Caddy → a single-process synchronous SQLite. The leaderboard runs up to 4 full aggregates per request, uncached.
- **Source images are oversized:** a 798 KB PNG portrait, a 596 KB PNG and a 525 KB site PNG. `next/image` resizes them, but the repo and the optimizer carry the weight.
- **Good news:** no console errors, no horizontal scroll on any page, CLS ≤ 0.06, FCP 0.35–0.7 s.

### 2.9 How hard is it to add a game today?
**A new game touches 12–15 files outside its own folder:**
- the route (`app/<slug>/page.tsx`), `registry.ts`, and `slugs.ts` (3 maps);
- `saves.ts`, `results.ts`;
- `expedition/stages.tsx` (imports plus 3 `switch` statements) and `expedition/settings.ts`;
- `api/src/validate.ts` (the API must be deployed first);
- `logbook/discoveries.ts`, `logbook/achievements.ts`, `logbook/messages.ts`;
- CSS.

**Inside the game folder,** `store.ts`, `status.tsx`, `Play` and the result header are about 200 lines copied from game to game.

**Settings and links won't scale:** expedition difficulty settings are named after specific games (`digs`, `guesses`, `attempts`, `spare`), and challenge links depend on the order of `GAME_SLUGS`.

**The daily model assumes every player plays every game every day:** "6/6", the next-up trail, the "all done" confetti.

**Verdict:** the architecture is clean for about 6 games and has good shared pieces (map, year dial, picker, panels, `triesPoints`, `dailyIndex`, the `…Board` pattern). **It does not scale to dozens.** A per-game *definition* object with lazy loaders is a prerequisite for "many more games" (Roadmap phase 3).

---

## 3. What geocore.fun does

### 3.1 Catalogue and structure
- **Scale:** "100+ games and 2,200+ map quizzes on one account". Its sitemap lists **111 `/play/*` games**, and the play hub showed "Games 157" including variants.
- **Games are grouped into colour-coded families**, each with a code (e.g. `M-05`, `S-04`, `W-04`):

  | Family | Examples |
  |---|---|
  | **Map** | Click the Country, Type the Countries, Pin Drop, Closest City to the Dot, Ring Map, City Bearings, Coordinates |
  | **Shapes & borders** | Shape Quiz, Spot the Land Grab, Geo Puzzle, Border Chain, Border Route, Draw the Border, Size Up, Merged Countries, Pixelated Outline |
  | **Flags** | Flag Quiz, Flag Peek, Paint the Flag, Pie-chart Flag, Which Flag |
  | **Words & puzzles** | Geordle, Hangman, Letter Chain, Clue Guesser, Scrambled Country, Common Ground, Spin Quiz, Word Search, Geo Grid |
  | **Numbers & facts** | Higher or Lower, Estimate, Rank It, Metric Quiz, Population Race, Tier List |
  | **Modes** | Survival Run, Hardest Gauntlet, Quickplay (one question from a different game each round), Custom combination |
  | **Seasonal and photo** | Feast Origins (Thanksgiving), Landmarks (photo → name or pin), Northbound (rotate a satellite image), Dead Reckoning, Flight Plan, Lights On |

- **Hub pattern (`/play`):**
  - A **Daily Games** strip on top: 5 cards with a thumbnail, family colour, `#n`, today's variant, a tier chip ("FREE ACCOUNT") and a stats button. "0/5 done today", a countdown to new dailies, plus Archive and All dailies buttons.
  - Then a **searchable, filterable game grid**: tabs by family with counts, Favourites, "Surprise me".
  - Each tile has an illustrated thumbnail, family + code, title, a one-line rule, and an allowance chip ("UNLIMITED", "1 LEFT TODAY", "Pro").
  - Selecting a tile opens a **right-hand setup panel** (bottom sheet on mobile) with How to play, Options (region, difficulty set, number of questions) and a big green Play button.
- **In game:**
  - A full-bleed globe.
  - A **HUD pill bar**: round counter "1 / 10", stars, combo, accuracy, timer, Pause, Skip, End, Hint (with pips), Info, favourite, settings, language, sound, fullscreen.
  - A prompt plaque ("FIND THIS COUNTRY — Russia").
- **Results:**
  - A score ring with "points of 1,500" and a stat grid (correct, missed, accuracy, best combo, time).
  - Today's daily, Play again, All games, and Create challenge (Pro).
  - **Answer-by-answer review**, "What you missed" with flags, a copyable share block with an emoji grid and a deep link.
  - An account upsell for guests ("Save your scores").
- **Daily page:** 5 rotating dailies, plus "your country's daily", a **Pro weekly special** every Monday (harder, one attempt, its own board), an archive, and reminders.
- **Leaderboards:**
  - Tabs: Global, **Weekly league**, **Clubs**, **Nations**, Game boards.
  - Filters: Overall XP or Total Mastery; Everyone, Top 100, Friends, Country, Club or Continent; a period.
  - Rows show rank medals, avatar frames, flags, Pro/Developer/version badges, XP and a level ring.
- **Social:**
  - Private lobbies of up to 16 with live standings.
  - Join with a code from the home page.
  - Friends, clubs, community-made quizzes with a "Hall of Fame".
  - Classroom mode (Geocore Education).

### 3.2 Monetization (from the `/pricing` FAQ)
- **Guest:** 1 game a day (out of 11), daily challenges as practice, saved on the device.
- **Free account:** 86 web games with **5 games a day** (resets 00:00 UTC). Today's dailies don't count. **8 classic games are unlimited.** Daily challenges, streaks, leaderboards, friends and lobbies are included.
- **Pro, $4.99/month or $29.99/year** (seasonal promo codes, shown in a top banner and a "−65%" pill in the nav):
  - Unlimited play, every game and setting, and **every past daily**.
  - "See which places you miss" (analysis and spaced repetition).
  - **Cosmetics:** profile frames, banners, name styles, lobby reactions.
  - **Lobbies of 16, and a Pro host unlocks every game for the whole lobby.**
  - Bonus dailies, +10% weekly league points, an AI coach, no ads.
- **Upsell surfaces:**
  - tier chips on every tile and daily card;
  - a "1 of 1 free game left today" strip under the header;
  - Pro badges on mode buttons (Quickplay, Custom combination);
  - result-screen cards ("Study them with Pro", "Create challenge Pro");
  - a promo banner and the pricing nav pill;
  - leaderboard rows showing PRO badges, which acts as social proof.

### 3.3 Design language (from its compiled CSS)
- **Dark "space HUD":**
  - Background ramp `#01040b → #040914 → #07111f → #0a1727 → #0d2032 → #123653`.
  - Text `#edfaff / #a9c6d8 / #6f91a7`.
  - Blue accents `#1e72e8 / #4fabf6`, gold `#ffd45c` (Pro), green `#3ef08a` (play/success), danger `#ff466d`.
  - **Family colours:** map blue, shapes teal `#2dd4bf`, flags periwinkle `#818cf8`, words purple `#c77dff`, numbers pink `#f472b6`.
- **Fonts:** Chakra Petch (UI, techy), Bricolage Grotesque (display), JetBrains Mono (labels and numbers). It also offers a dyslexia/Atkinson reading-font setting.
- **Shape:** small radii (2–8 px), glass cards (`backdrop-filter: blur(18–22px)`), 1 px cyan-tinted borders, **chunky "key" buttons** with a darker bottom edge and an inset press shadow, inner glows.
- **Motion:** named easings `out (.16,1,.3,1)`, `spring (.34,1.42,.5,1)`, `press (.3,0,.2,1)`, `emphatic (.2,.8,.2,1)`.
- **Density:** high information density, mono uppercase eyebrows, lots of small chips and badges, illustrated thumbnails everywhere.

**What we should take:** the information architecture (catalogue + families + dailies strip + setup panel), the HUD and result-review patterns, chips and tier badges, leagues, the lobby perks model, the dark glass look and the chunky buttons.

**What we should not copy:** their exact brand (logo, fonts, exact hexes, names like "Geordle"), their per-game code system as-is, and their aggressive promo banners. Our identity hook stays **Who · When · Where**: people, time and place, which geocore doesn't cover (it is purely geography).

---

## 4. Design system proposal (Tailwind v4)

**Direction: "Night Atlas."** Dark-first, glassy navy surfaces, and electric accents like geocore, but organised around our three pillars. Each pillar gets a signature colour that runs through tiles, chips, HUD accents and share cards: **Who = coral, When = amber, Where = cyan**. A cool "Daylight" light theme remains for those who want it. The old paper look can live on as an optional "Atlas" theme later (Pro cosmetic), so the current identity isn't thrown away.

### 4.1 Palette

All text pairs below were checked against WCAG 2.1. Ratios are on `night-900 #0b1424` (dark) and `#ffffff` (light).

**Surfaces (dark)**

| Token | Hex | Use |
|---|---|---|
| `night-990` | `#03070f` | page behind the hero and the game canvas; `theme-color` |
| `night-950` | `#060b16` | app background |
| `night-900` | `#0b1424` | cards, header |
| `night-850` | `#111d33` | raised cards, inputs |
| `night-800` | `#172742` | hover and selected surfaces |
| `night-700` | `#20365a` | borders on raised surfaces, map land (dark) |
| `night-600` | `#2c4a77` | strong borders, map land highlight |
| `line` | `rgb(79 200 255 / 0.16)` | 1 px hairlines (cyan-tinted) |

**Text**

| Token | Dark | Ratio | Light | Ratio |
|---|---|---|---|---|
| `fg` | `#eef5ff` | 16.8 | `#0b1424` | 18.4 |
| `fg-2` | `#a9bdd4` | 9.6 | `#3c4f68` | 8.4 |
| `fg-3` (min. 12 px) | `#8197b0` | 6.1 | `#5a6d86` | 5.3 |

**Brand and states**

| Token | Dark | Ratio on night-900 | Light variant | Use |
|---|---|---|---|---|
| `primary` | `#3d8bff` (button fill `#2f6fe0`, white text 4.7:1) | 5.6 | `#1f63d6` (5.5) | links, primary buttons, focus ring |
| `play` | `#36d98a` (ink `#06210f` on it, 9.3:1) | 10.1 | `#0f7a4c` (5.4) | the Play / Start button, correct answers, success |
| `danger` | `#ff5f7a` | 6.3 | `#c8324f` (5.2) | wrong, destructive |
| `pro` | `#ffc94d` (ink `#1a1302` on it, 12:1) | 12.0 | `#8a5a00` | Pro badges, premium |
| `guess` | `#ff7a59` | 7.2 | `#c4452a` (5.0) | the player's pins and lines (kept from today) |
| `answer` | `#36d98a` | 10.1 | `#0f7a4c` | the truth on the map (kept from today) |

**Families** (tile accents, chips, HUD stripe, share-card colour)

| Family | Hex | Ratio on night-900 | Current games mapped |
|---|---|---|---|
| **Who** · people | `#ff7a59` coral | 7.2 | Who When Where |
| **When** · time | `#ffb547` amber | 10.5 | First to Last |
| **Where** · places | `#4fc8ff` cyan | 9.7 | Dig Site, Wayfarer |
| Borders & shapes | `#2fd3b4` teal | 9.7 | Overland, Outline |
| Flags & symbols | `#8f97ff` periwinkle | 7.1 | — |
| Words & trivia | `#b58cff` violet | 7.2 | — |
| Numbers & facts | `#f472b6` pink | 7.0 | — |

**Map (dark)**
- Sea `#071226`, land `#20365a`, borders `#4d6f99`, graticule `rgb(79 200 255 / .06)`.
- Land and sea now differ clearly in contrast (today they are 1.33:1).
- **Heat scale (far → near):** `#6a74ff → #4fc8ff → #ffd24d → #ff9a3d → #ff5f5f`. It is always paired with a number or text, never colour alone.

**Rules**
- Text under 14 px uses `fg-2` or brighter.
- `fg-3` is never below 12 px.
- Family and state colours are for fills, borders and icons. As text, only at ≥ 14 px on dark surfaces.

### 4.2 Typography
Load everything through `next/font` with **latin + latin-ext only, no italics, no unused axes**. Target ≤ 150 KB of fonts per page, down from about 494 KB.

| Role | Family (OFL, Google Fonts) | Weights | Notes |
|---|---|---|---|
| Display / headings | **Space Grotesk** | 500–700 (variable) | Techy and geometric, like geocore's feel without copying its fonts |
| UI / body | **Manrope** | 400–800 (variable) | Legible at small sizes; good PT diacritics |
| Numbers / labels / HUD | **IBM Plex Mono** (kept) | 500, 600 | `tabular-nums` for scores and timers |
| Wordmark only | Fraunces italic → **an inline SVG logo** | — | Keeps the "*When*" brand flourish with zero font cost |

**Scale** (rem, with `clamp` for display sizes):

| Name | Size | Use |
|---|---|---|
| `text-xs` | 0.75 | chips, captions (mono uppercase, `tracking-[0.08em]`) |
| `text-sm` | 0.875 | secondary UI |
| `text-base` | 1 | body |
| `text-lg` | 1.125 | |
| `text-xl` | 1.25 | card titles |
| `text-2xl` | 1.5 | section headings |
| `text-3xl` | 1.875 | page titles |
| `text-display` | clamp(2.5, 1.6 + 4vw, 4.5) | hero |
| `text-score` | clamp(3, 2 + 5vw, 6) | result score (mono) |

**Rule:** no UI text under 12 px. Today labels go down to 9 px.

**Accessibility setting:** a "Readable font" toggle that swaps in Atkinson Hyperlegible (geocore offers OpenDyslexic and Atkinson).

### 4.3 Spacing, layout, radius, elevation
- **Spacing:** Tailwind's default 4 px step (`--spacing: 0.25rem`). Section rhythm uses `gap-4` for cards, `gap-6` inside panels and `py-10 / md:py-16` between sections.
- **Containers:** one page width everywhere, `--container-page: 76rem`, with `px-4 md:px-6`. A narrow reading column is `--container-prose: 42rem`. **All social pages share `page` width**, which fixes the tab jump (G10).
- **Breakpoints:** Tailwind defaults (`sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`).
- **Layouts**
  - **Game:** map-first. On mobile the map is full width, with a sticky **bottom action bar** holding the primary button (fixes P2) and safe-area padding.
  - **Catalogue:** a 2/3/4/5-column grid at sm/md/lg/xl.
  - **Setup:** a right panel of 22 rem on `lg+`, a bottom sheet below that.
- **Radius:** `xs 4px`, `sm 6px`, `md 8px` (buttons, inputs), `lg 12px` (cards, tiles), `xl 16px` (sheets, modals), `pill 999px` (chips, HUD).
- **Elevation, dark-friendly:** no cream offset shadows (fixes G9).
  - `shadow-card`: `0 1px 0 rgb(255 255 255 / .04) inset, 0 8px 24px rgb(0 0 0 / .35)`
  - `shadow-raised`: `0 1px 0 rgb(255 255 255 / .06) inset, 0 16px 40px rgb(0 0 0 / .45)`
  - `shadow-key` (button bottom edge): `0 3px 0 var(--key-edge)`, plus `shadow-press` (inset) when active.
  - `glow-{family}`: `0 0 0 1px rgb(var(--fam) / .5), 0 0 24px rgb(var(--fam) / .25)` for selected tiles.
- **Glass:** `bg-night-900/80 backdrop-blur-xl border border-line`. It falls back to a solid surface when `prefers-reduced-transparency` is set and on low-end devices (G7). Drop the full-screen grain overlay; if a texture is wanted, use a subtle static star field or graticule inside the hero only.

### 4.4 Components (build once, in `components/ui/`)

| Component | Variants and notes |
|---|---|
| **Button** | `primary` (blue key), `play` (green key, ink text), `secondary` (outline on glass), `ghost`, `danger`, `pro` (gold). Sizes `sm 36px / md 44px / lg 52px`, so the touch target is ≥ 44 px on mobile. "Key" press: `translate-y-[2px]` plus `shadow-press`. Disabled is a dimmed surface with a "why" tooltip or line, not a grey slab. Loading spinner |
| **IconButton** | 44 px, always with a visible label on ≥ md or a tooltip, and `aria-label` |
| **Chip / Badge** | family chip (dot + name), tier chips (`FREE`, `UNLIMITED`, `2 LEFT`, `PRO`, `NEW`), status chips (`Done`, `Streak 🔥 12`). Minimum 12 px text |
| **GameTile** | 16:10 illustrated thumbnail (SVG per game, coloured by family); family chip + code; title; one-line rule; footer with today's status and tier chip. A selected state with a family glow. A View-Transition morph into the game header |
| **DailyCard** | compact horizontal tile for the dailies strip: thumbnail, "#123", today's variant, status ring |
| **SetupPanel / Sheet** | right panel (lg) or bottom sheet (mobile): How to play (with an animated example), Options (segmented controls), Play button. Proper `role="dialog"`, focus trap, Esc |
| **HUD** | pill bar: round `3 / 10`, score, streak/combo, timer (mono, tabular), Hint with pips, Skip, End, Info, sound. Collapses to two rows on mobile |
| **PromptPlaque** | "FIND THIS PERSON'S BIRTHPLACE" eyebrow + big prompt; family-coloured top stripe |
| **ResultCard** | score ring (animated count-up), "x of 1,000", stat grid, **answer-by-answer review**, share block (emoji grid + link), next actions (Next daily · Play again · Challenge a friend), optional upsell slot |
| **SegmentedControl, Tabs, Select** | one style for all pickers (the leaderboard currently mixes a native `<select>`) |
| **Combobox** | WAI-ARIA combobox/listbox for country, person and journey pickers. Replaces `CountryPicker` and Wayfarer's picker (fixes §2.5) |
| **Modal / Dialog** | `aria-labelledby`, initial focus on the title rather than the close button, return focus on close |
| **Toast** | top-centre on mobile, never over the active list; `role="status"` |
| **Avatar** | initials or emoji; optional **frame** (cosmetic) and presence ring + `sr-only` "online" |
| **LeaderboardRow** | rank medal 1–3, avatar, name, flag, badges, score, delta; highlight for "you" |
| **StatTile, ProgressRing, StreakFlame, Countdown, Skeleton** (per-game shapes), **EmptyState**, **ProTeaser / PaywallCard** |
| **BottomNav** (mobile) | Home · Play · Daily · Social · Me, with badges |

### 4.5 Motion
- **Durations:** `fast 120ms` (hover, press), `base 200ms` (panels, chips), `slow 320ms` (sheets, page), `celebrate 600–900ms` (score count-up, streak flame).
- **Easings** (our own names): `--ease-out: cubic-bezier(.16,1,.3,1)`, `--ease-spring: cubic-bezier(.34,1.4,.5,1)`, `--ease-press: cubic-bezier(.3,0,.2,1)`.
- **Patterns**
  - Tile → game morph with the **View Transitions** support covered in the bundled Next guide (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).
  - Map fly-to at 600–900 ms.
  - Correct answer: a pin bounce plus a green ring pulse. Wrong answer: a 6 px shake.
  - Confetti only on a finished daily set.
- **Reduced motion:** every JS animation (map fly-to, dial coasting, count-ups) checks `prefers-reduced-motion` too, not only CSS (P13).

### 4.6 Mapping to Tailwind v4 tokens

Replace the ~5,000 lines of global CSS step by step with utilities plus a small `@layer components`. Tokens live in `app/globals.css`:

```css
@import "tailwindcss";

/* Theme switch: dark is default; data-theme="light" opts out. */
@custom-variant light (&:where([data-theme=light], [data-theme=light] *));

@theme {
  /* raw palette */
  --color-night-990: #03070f;  --color-night-950: #060b16;
  --color-night-900: #0b1424;  --color-night-850: #111d33;
  --color-night-800: #172742;  --color-night-700: #20365a;
  --color-night-600: #2c4a77;

  --color-who: #ff7a59;   --color-when: #ffb547;  --color-where: #4fc8ff;
  --color-shapes: #2fd3b4; --color-flags: #8f97ff; --color-words: #b58cff;
  --color-numbers: #f472b6;
  --color-pro: #ffc94d;

  /* fonts (next/font variables) */
  --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--font-manrope), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  /* radius, shadow, motion */
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px;
  --shadow-card: inset 0 1px 0 rgb(255 255 255 / .04), 0 8px 24px rgb(0 0 0 / .35);
  --shadow-raised: inset 0 1px 0 rgb(255 255 255 / .06), 0 16px 40px rgb(0 0 0 / .45);
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-spring: cubic-bezier(.34, 1.4, .5, 1);
  --ease-press: cubic-bezier(.3, 0, .2, 1);
  --container-page: 76rem;
  --container-prose: 42rem;
  --text-display: clamp(2.5rem, 1.6rem + 4vw, 4.5rem);
  --text-score: clamp(3rem, 2rem + 5vw, 6rem);
  --animate-pop: pop 320ms var(--ease-spring);
}

/* semantic layer: components use these, themes swap them */
:root {
  --bg: #060b16; --surface: #0b1424; --surface-2: #111d33; --surface-3: #172742;
  --fg: #eef5ff; --fg-2: #a9bdd4; --fg-3: #8197b0;
  --line: rgb(79 200 255 / .16);
  --primary: #3d8bff; --primary-fill: #2f6fe0; --play: #36d98a; --danger: #ff5f7a;
  --guess: #ff7a59; --answer: #36d98a;
  --sea: #071226; --land: #20365a; --land-edge: #4d6f99;
}
[data-theme="light"] {
  --bg: #f4f7fb; --surface: #ffffff; --surface-2: #eef3f9; --surface-3: #e3ebf5;
  --fg: #0b1424; --fg-2: #3c4f68; --fg-3: #5a6d86;
  --line: rgb(11 20 36 / .12);
  --primary: #1f63d6; --primary-fill: #1f63d6; --play: #0f7a4c; --danger: #c8324f;
  --guess: #c4452a; --answer: #0f7a4c;
  --sea: #e8f0f8; --land: #c9d6e6; --land-edge: #7d93ab;
}
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface);
  --color-surface-2: var(--surface-2); --color-surface-3: var(--surface-3);
  --color-fg: var(--fg); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3);
  --color-line: var(--line); --color-primary: var(--primary);
  --color-play: var(--play); --color-danger: var(--danger);
  --color-guess: var(--guess); --color-answer: var(--answer);
}
```

Usage looks like `bg-surface text-fg border-line rounded-lg shadow-card`, `text-who`, `bg-pro text-[#1a1302]`, `max-w-(--container-page)`, `ease-(--ease-spring)` and `light:bg-white`.

**What this fixes:**
- Each dark rule is no longer written twice (today `globals.css` duplicates every dark token, once for `prefers-color-scheme` and once for `data-theme`).
- Unused CSS stops shipping to every page.

**Theme script:** `THEME_SCRIPT` keeps setting `data-theme`, and "system" maps to `light` only when the OS asks for it.

---

## 5. New games

**Platform games first.** geocore's 2,200 quizzes come from a few *engines* fed by data. We should do the same and build four reusable engines in Phase 6:
- **Pin** (drop a pin, scored by distance),
- **Pick** (multiple choice and higher/lower),
- **Order** (sort cards on a timeline or by a value),
- **Name** (typed answer with a combobox, clue ladder).

Most games below are a data file plus a config on one of these engines.

**Every game gets two modes:** **Daily** (the same for everyone, counts for streaks) and **Practice** (unlimited and random, the natural free/Pro allowance lever).

**Difficulty to build:** LOW = data plus an existing engine, 1–3 days. MEDIUM = new UI or a new data pipeline, about 1 week. HIGH = a new engine, heavy data or server logic, 2+ weeks.

**Licence column:** what matters for a paid product. CC0 and PD are free to use. CC BY needs attribution. CC BY-SA needs attribution and share-alike of that content.

| # | Game | Family | Rules | Data source (free/public) | Engine | Build |
|---|---|---|---|---|---|---|
| 1 | **Lifelines** | Who · When | Five famous people. Drag them into birth order; correct positions lock. 3 attempts. Bonus: show who overlapped | Wikidata (P569/P570, CC0) + our `people.json`; Commons portraits | Order (reuses First to Last) | LOW |
| 2 | **Clue Ladder** (Who am I?) | Who | A hidden person and 6 clues, from vague to obvious (century → field → country → famous work → initials). Guess at any rung; fewer clues = more points | Wikidata (P106 occupation, P27 citizenship, P800 notable work, CC0) | Name | LOW |
| 3 | **Born Here** | Who · Where | A city is lit on the map: which of 4 people was born there? 10 rounds, survival variant | Wikidata P19 + P625 (CC0); expand the roster to 500+ people via `scripts/fetch-people.mjs` | Pick | LOW |
| 4 | **Could They Have Met?** | Who · When | Two people: did their lifetimes overlap? Yes/No, with a streak run. Reveal shows both lifelines | Wikidata dates (CC0) | Pick (higher/lower) | LOW |
| 5 | **Earlier or Later** | When | Endless: is the new event before or after the last one? 3 lives | `first-to-last/events.ts` (149) + Wikidata events with P585 point in time (CC0) | Pick | LOW |
| 6 | **Timeline** | When | Build a timeline: each new card must be slotted in the right gap. 3 mistakes allowed; score = cards placed | Same events + inventions (Wikidata P575, CC0) | Order | MEDIUM |
| 7 | **Year Snap** | When | A historical photo: set the year on the dial. Score by distance. 5 photos | Wikimedia Commons PD photos with dates; Library of Congress PD collections. Store author and licence per image | Year dial (exists) | MEDIUM |
| 8 | **Same Year** | When | Four events: three happened in the same year. Spot the odd one out | Wikidata events (CC0) | Pick | LOW |
| 9 | **Pin the City** | Where | A city name: drop a pin. Score by km. 10 rounds; region filters (World, Europe, Brazil…) | Natural Earth populated places (PD) or GeoNames cities15000 (CC BY 4.0) | Pin (reuses map) | LOW |
| 10 | **Click the Country** | Where | A country name: tap it on the map. Timed, 3 tries per country; region sets | `lib/data/countries.json` (Natural Earth, PD) | Pin (country hit-test) | LOW |
| 11 | **Type the Countries** | Where | Name as many countries as you can in 8 minutes; each one lights up | Same | Name | LOW |
| 12 | **Flag Peek** | Flags | A flag is hidden under tiles; each wrong guess removes tiles. Name it in 6 | Flags from Wikimedia Commons (most are PD) or the `flag-icons` package (MIT) | Name | LOW |
| 13 | **Higher or Lower: Countries** | Numbers | Population, area, GDP, life expectancy, coastline… Which is higher? Endless with lives | World Bank Open Data API (CC BY 4.0); Wikidata (CC0) | Pick | LOW |
| 14 | **Border Chain** | Shapes | Start in a country; each answer must border the previous one; no repeats; reach the target in the fewest steps, or the longest chain against the clock | `countries.json` borders (exists) | Name | LOW |
| 15 | **Landmark Lens** | Where | A photo of a landmark: pin where it is. Bonus for naming the country. 5 rounds | Wikidata P18 image + P625 coords (CC0) + Commons photos (per-file licence); reuse the `fetch-sites.mjs` pipeline | Pin | MEDIUM |
| 16 | **True Size** | Shapes · Numbers | Two countries at true scale, side by side: which is bigger, and by how much? Then drag one over the other | Natural Earth geometry (PD), equal-area projection in d3-geo | Pick + custom drag | MEDIUM |
| 17 | **Rivers & Ranges** | Where | A river (or mountain range) is drawn: name it, then name the countries it passes through | Natural Earth rivers/lakes and geographic regions (PD); Wikidata P205 basin countries (CC0) | Name | MEDIUM |
| 18 | **Then & Now** | When · Where | A historical border map from year X: which modern country covers the highlighted area? Or which empire held it? | Historical boundary datasets. ⚠️ Check licence: many are GPL or **non-commercial** (e.g. CShapes is CC BY-NC-SA). Prefer self-built from Wikidata P576/P571 dates + Natural Earth | Pick + map | HIGH |
| 19 | **Snapshot** (flagship) | Who · When · Where | One historical photo, three questions: **who** is in it, **when** it was taken (dial), and **where** (pin). Scored like Who When Where | Wikidata items with P180 depicts + P585 date + P1071 location, and a Commons PD image | Pin + dial + Name | HIGH |
| 20 | **Life Tracks** | Who · Where | A person's life as a route: places lived, in order, revealed step by step. Name the person (like Wayfarer, for lives) | Wikidata P551 residence + P580/P582 qualifiers, P19, P20 (CC0); sparse, needs curation | Name (reuses Wayfarer route) | MEDIUM |
| 21 | **Quickplay / Gauntlet** (mode) | All | One question from a different game each round; Gauntlet is survival with escalating difficulty. Free: 1 run/day | All engines | Mode | MEDIUM |
| 22 | **Weekly Special** (mode) | Rotates | Every Monday, one harder puzzle, one attempt, its own board | Any game | Mode | LOW (after platform) |

**Two rules for every new game's content pipeline:**
1. **Store author, licence and source URL for every image** and show them on the reveal. Today `people.json` and `sites.json` have only `src/width/height`.
2. **Strip Wikipedia hatnotes and give-away text** in the build scripts.

---

## 6. Social features

Today's foundation is decent: accounts, usernames, friends, presence, chat, DMs, leaderboards and parties. What's missing is **identity, loops, safety and server-side progression**.

### 6.1 Profiles
- **Clean URL `/u/[username]`** with real metadata and a **dynamic OG card**: level, streak, favourite family. Use `opengraph-image.tsx` + `ImageResponse` from `next/og`, per the bundled docs (`01-getting-started/14-metadata-and-og-images.md`). Today the profile is `/player?u=` with the generic title "Player".
- **Header:** avatar with optional frame, display name, @username, country flag (opt-in), level ring, Pro badge, member since.
- **Showcase:** best stats, rarest achievements (from the server-side logbook, §6.7), favourite games, streak.
- **Actions:** Add friend · Message · Challenge · Invite to party · ⋯ (Block, Report).
- **Privacy:** public / friends-only profile; hide online status. Today anonymous visitors see presence and full activity.

### 6.2 Friends and messaging
- **An inbox** at `/social/messages`: a conversation list with unread counts, opened from the bell or badge. Today DMs only open from a friend row.
- **Friend suggestions:** people from your parties, players you challenged, contacts via your invite link.
- **Invite link with referral:** `/i/<code>`. The newcomer lands on a welcome page showing who invited them, then plays today's dailies. Both get a cosmetic once the newcomer finishes 3 dailies.
- **Safety:** block (hides chat, DMs, requests and parties in both directions), report (message, profile, party) to a moderation queue, a server-side word filter for chat and names, reserved usernames, rate-limited username changes.

### 6.3 Daily challenge
- **Move from "play all 6" to "Today's Five":** five dailies picked each day by a schedule across the whole catalogue, with Who When Where always included as the flagship. "5/5" completes the day.
- Every other game remains playable in Practice.
- **Day boundary = UTC, server-defined.** It is the same for everyone and can't be shifted with the device clock. Show "New dailies in 6 h 12 m" in local time. ⚠️ This is a migration: keep current saves valid and map local-date day N to UTC day N once.
- **Weekly Special** (Monday) and an optional **Country daily** later.
- **Daily recap card:** a shareable image + emoji grid of all five, generated with `ImageResponse`.

### 6.4 Leaderboards
- **Tabs:** Today · This week (league) · All time · Per game. **Scopes:** Everyone · Friends · Country.
- **Weekly leagues:** groups of about 30 players matched by last week's activity, with promotion and relegation across tiers (Bronze → Diamond). A league is a strong reason to come back without needing a huge population.
- **Rows:** rank medal, avatar and frame, flag, badges, points, delta since yesterday.
- **Integrity:** scores computed **on the server** from the submitted moves (§7.3), plus the UTC day. "Verified" leaderboards should come only after this.
- **Performance:** cache the boards (recompute every 60 s or on write) instead of 4 full aggregates per request.

### 6.5 Streaks
- **One definition everywhere**, computed on the server for signed-in players: "a day with ≥ 1 daily finished" for the play streak, and "5/5" for the perfect streak.
  - Today there are three: per game, the hub's local streak and the server's UTC−12 rule.
- **Streak freeze:** 1 earned per week of play; Pro holds 3. It's protective, not punitive, and a natural reason to come back and to subscribe.
- **Reminders:** opt-in **Web Push** (the PWA already exists) 2 h before the day ends if the streak is at risk. Also for friend requests, party invites and challenges.
- **Milestones:** 7, 30, 100 and 365 days, with a badge, a profile flair and a share card.

### 6.6 Sharing and challenges
- **Challenge links with identity:** `/c/<id>` stored on the server, carrying the sender, their score and the exact puzzles.
  - The recipient sees "Ana scored 3,420 — beat it". At the end they get a **head-to-head result**, a rematch button and an automatic friend suggestion.
  - Today `?c=` carries no sender, no score, and is ignored if you've played an expedition before (S1).
- **Async duels:** challenge a friend directly from their profile. They get an inbox and a push notification, and results appear in both inboxes.
- **Share sheet:** native `navigator.share` with the image card, falling back to copy. Show feedback in both cases; today it only does so on copy.

### 6.7 Server-side progression
- **Move XP, levels, achievements and discoveries to the API** (new tables in a migration), with a one-time upload of local logbook data on sign-in.
- **Expedition, party and practice play earn XP too,** at a lower rate than dailies.
- **XP drives** the league score, profile levels and cosmetic unlocks.

### 6.8 Parties
- **Fixes first:** S2–S6. Add a confirm and server-side guards for mid-run restarts. Treat "away" as not done. **Host migration** after 20 s away. A **ban list** for kicked players. A **join confirm** page.
- **Quick Play:** "Join a public party" picks an open room or creates one.
- **Lobby UX:**
  - A compact settings card, with game presets (Classic 6 · Speed round · Time travel · Around the world).
  - "Start" always visible.
  - Ready checks.
  - **Reactions** (emoji bursts; extra sets are a Pro cosmetic).
  - Rematch with the same group.
- **Spectating:** late joiners watch live standings and play from the next run.
- **Transport:** replace 2.5 s polling with **Server-Sent Events** (or WebSockets) on the API host, connected directly to `api.<domain>` with a parent-domain cookie. This saves the Vercel rewrite hop and is roughly 10× cheaper per user.
- **Size:** 8 seats for free hosts, 16 for Pro hosts. A Pro host unlocks Pro games for everyone in the room, which is geocore's best social-monetization idea.

### 6.9 Clubs (later)
Small groups (school, family, Discord) with a club leaderboard, a club daily and club chat, in place of the global chat as the main community space. A global room is the hardest place to moderate and the least valuable.

---

## 7. Monetization-ready architecture

**Goal:** design so a subscription can be switched on later without rewriting. **No payment integration now.**

### 7.1 Principles
1. **Today's dailies, streaks, friends and basic parties are always free.** They are the habit loop and the growth engine.
2. **Sell abundance, depth and identity:** unlimited practice, the archive, analysis, bigger rooms, cosmetics. Never sell basic fairness: no pay-to-win on leaderboards.
3. **One upsell at a time, never mid-puzzle.** Upsells sit on tiles, result screens, limit boundaries and the account page.
4. **The server decides.** The client only *displays* entitlements.

### 7.2 Tiers (proposal)

| | Guest | Free account | **Pro** |
|---|---|---|---|
| Today's 5 dailies | ✅ (saved on device) | ✅ | ✅ + bonus daily |
| Practice games | 3 / day | 10 / day (classic 6 unlimited) | **Unlimited** |
| Archive of past dailies | — | last 3 days | **All** |
| Weekly Special | play | play + board | play + board + past specials |
| Streaks / freezes | local | ✅ / 1 per week | ✅ / up to 3 held |
| Leaderboards, leagues, friends, DMs | — | ✅ | ✅ |
| Parties | join only | host up to 8 | **host up to 16; Pro games unlocked for the room** |
| Expedition / custom runs | basic presets | basic presets | **all settings, saved presets, Quickplay unlimited** |
| Stats | basic | basic per game | **deep stats: weak spots by region/era, accuracy trends, review mode** |
| Cosmetics | — | 8 avatar colours | **frames, banners, name colours, extra reactions, "Atlas" paper theme** |
| Early access to new games | — | — | ✅ |

**Price anchor for testing:** USD 3.99/month · 29.99/year; for Brazil, localized pricing (e.g. R$ 14.90/month · R$ 99/year). geocore charges $4.99 / $29.99.

### 7.3 Server-side pieces (API)

**Schema:** append a migration to `api/src/db.ts`; never edit old migrations.

```sql
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';        -- 'free' | 'pro'
ALTER TABLE users ADD COLUMN plan_expires_at INTEGER;                  -- null = no expiry (comp)
CREATE TABLE subscriptions (                                           -- filled by a future billing adapter
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, provider_customer TEXT, provider_sub TEXT UNIQUE,
  status TEXT NOT NULL, period_end INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE payment_events (provider TEXT, event_id TEXT, received_at INTEGER, PRIMARY KEY(provider, event_id)) STRICT;
CREATE TABLE entitlement_grants (                                      -- comps, referrals, promos
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, feature TEXT NOT NULL,
  expires_at INTEGER, reason TEXT, PRIMARY KEY(user_id, feature)
) STRICT;
CREATE TABLE usage (                                                   -- daily allowances
  user_id INTEGER NOT NULL, day INTEGER NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY(user_id, day, kind)
) STRICT;
```

**Shared plan table:** a single source of truth, `shared/plans.ts`, imported by both the API and the site. The API already runs TypeScript directly, so this needs only a workspace path:

```ts
export const FEATURES = ["practice.unlimited", "archive.all", "party.host16", "party.unlockGames",
  "expedition.allSettings", "stats.deep", "cosmetics.pro", "streak.freeze3", "games.early"] as const;
export const LIMITS = { guest: { practicePerDay: 3 }, free: { practicePerDay: 10, archiveDays: 3, partySeats: 8 },
  pro: { practicePerDay: Infinity, archiveDays: Infinity, partySeats: 16 } };
```

**API**
- `GET /me` returns `{ plan, features[], limits, usageToday }`.
- Middleware `requireFeature("archive.all")` returns **402** with `{ code: "upgrade_required", feature }`.
- `POST /practice/start { game }` checks and increments `usage`, then returns a **puzzle seed signed by the server**. Practice results without a valid seed don't count.
- `MAX_MEMBERS` in `parties.ts` comes from the host's plan.
- **The billing adapter interface is defined, not implemented:** `createCheckout(user, plan)`, `handleWebhook(req)` (idempotent through `payment_events`), `portalUrl(user)`. Candidates later: Stripe (cards, global) and Mercado Pago (Pix, Brazil). Both feed the same `subscriptions` table.

### 7.4 Gating content properly (the hard part)

Today **every answer is in the JS bundle** and the day comes from the device clock, so any puzzle gate is cosmetic. A staged plan:

1. **Soft gates (Phase 13):** the client hides Pro features based on `/me`. That's acceptable for cosmetics, stats views and UI conveniences, and for "honest users" on practice limits.
2. **Server-dealt puzzles (Phase 14):**
   - Rosters move out of the client bundle into the API, or into per-day JSON files the API serves.
   - `GET /puzzles/:game/:day` returns **today's** puzzle to anyone. **Past days require `archive.all`** (or fall within the free window).
   - Practice puzzles come from `/practice/start`.
   - Answers ship only with the puzzle that is being played. The client bundle no longer contains the whole roster (also a big performance win, §2.8).
3. **Server grading (Phase 14):** `rules.ts` scoring moves to a shared package used by both sides. The API recomputes the score from the submitted moves, so leaderboards and leagues become trustworthy.

### 7.5 Where the paywall sits in the UI

| Surface | Trigger | What the player sees |
|---|---|---|
| Game tile / setup panel | Pro-only game or option | `PRO` chip; Play opens a **ProSheet** (benefits, price, "Maybe later"), never a dead end |
| End of a practice game | allowance used (`usageToday`) | Result card first, then "You've played your 10 practice games today. Pro is unlimited." + "Back to dailies" |
| Archive calendar `/daily/archive` | past day outside the window | Day tile with a lock and "Pro". Free days remain playable |
| Party lobby | host sets seats > 8, or picks a Pro game | Inline "Pro hosts can seat 16 and unlock every game for the room" |
| Expedition setup | advanced options | Options visible but locked, with a one-line why |
| Stats → "Deep dive" | open the tab | Blurred preview of the free player's own data + CTA |
| Profile → Customize | Pro cosmetics | Locked swatches/frames with a preview on your own avatar |
| Streak at risk | no freeze left | "Use a freeze" (if any) or "Pro holds 3 freezes" |
| `/pricing`, Account → Plan | always | Plan comparison, FAQ, current plan, manage |

**Component API:** `<Gate feature="archive.all" fallback={<ProTeaser feature="archive.all" />}>…</Gate>` reads `useEntitlements()`, which comes from `account/state.ts`. A 402 response from the API opens the same `ProSheet`, so gating can't drift between client and server.

**Pages in Next 16:**
- Optimistic redirects (signed-out → sign-in) can use **Proxy** (`proxy.ts`; Middleware was renamed in Next 16, see `01-getting-started/16-proxy.md`). The docs say plainly that Proxy is not an authorization layer: the API stays the authority.
- For pages that are entirely Pro, `forbidden()` exists, but it is **experimental** (`experimental.authInterrupts`). Prefer rendering a `ProTeaser`, which converts better than a 403 anyway.

### 7.6 Prerequisites before charging money
Required:
- e-mail verification;
- password reset (needs an e-mail provider);
- terms, privacy (**LGPD**), refund and cookie pages;
- a data export and the existing account deletion;
- per-image licence attribution (§1.4);
- the moderation basics (§6.2);
- the rate-limit IP fix (§2.7);
- off-site database backups (today they sit on the same disk).

---

## 8. Implementation roadmap

Phases are ordered so each one ships on its own and unblocks the next. Complexity: **LOW** (≤ 3 days), **MEDIUM** (about 1–2 weeks), **HIGH** (2+ weeks or architectural risk).

| # | Phase | Contents | Complexity |
|---|---|---|---|
| **0** | **Hotfixes** | **Expedition and party:**<br>- Challenge link ignored after a finished run (S1).<br>- Host wiping a live race: confirm + server guard (S2).<br>- Away ≠ done (S3).<br>- Kicked players can rejoin (S5).<br>- Party chat overflow (S6).<br>- "/4" → number of games (S7).<br><br>**Game logic:**<br>- `CountryPicker` filter-then-slice and Enter behaviour.<br>- Save mixing on missing roster items.<br>- Year dial: no default lock-in; commit typed value.<br>- `lib/ui.ts` panel reset on route change.<br><br>**App-wide:**<br>- `app/error.tsx` + `global-error.tsx`; save-shape validation.<br>- Strip Wikipedia hatnotes in `fetch-people.mjs`.<br>- Hashed image file names for Dig Site.<br>- `priority` → `preload`.<br>- **Check and fix the `X-Forwarded-For` rate-limit bucket** | LOW |
| **1** | **Quick a11y and perf wins** | - Raise `--ink-3` / red / heat text contrast to ≥ 4.5.<br>- 44 px targets.<br>- Dialog names and focus return.<br>- Reduced motion in JS animations.<br>- Trim fonts (drop WONK/SOFT/italic) to cut about 300 KB/page.<br>- Remove the fixed grain layer.<br>- Footer CLS.<br>- Detect the browser language for first-time visitors; `lang` follows the locale.<br>- Stop redirecting `/` for newcomers | LOW |
| **2** | **Design tokens and UI kit** | - Tailwind v4 `@theme` tokens and the semantic layer (§4.6); new fonts; Night Atlas dark default + Daylight.<br>- `components/ui/`: Button, IconButton, Chip, Card, Tabs, Segmented, Combobox, Dialog/Sheet, Toast, Avatar, StatTile, ProgressRing, Skeleton, EmptyState.<br>- A `/dev/ui` page to review them | MEDIUM |
| **3** | **Game platform refactor** | - One `GameDefinition` per game: slug, title, family, engine, `loadBoard()` and `loadData()` via dynamic import, store, `resultOf`, status, discoveries, expedition settings schema.<br>- Generic `store` / `status` / `Play` / result header.<br>- One dynamic route `app/play/[slug]` with `generateStaticParams`, plus **redirects** from the old URLs.<br>- Layout, hub and expedition stop importing every game (§2.9).<br>- Expedition settings become per-game schemas instead of `digs/guesses/attempts/spare`.<br>- Challenge links keyed by slug, not order | HIGH |
| **4** | **App shell and catalogue** | - New header (logo, nav pills, search `/`, language chip, avatar menu) and mobile **BottomNav**.<br>- `/play` catalogue: family tabs, search, filters, favourites, "Surprise me", illustrated SVG thumbnails per game.<br>- Setup panel / bottom sheet.<br>- Home becomes a dashboard (signed in) or landing (guest) with the **Today's dailies strip** | MEDIUM |
| **5** | **Game screen redesign** | - HUD bar, prompt plaque, map-first mobile layout with a sticky action bar, full-bleed map without letterboxing.<br>- Result card with answer-by-answer review; guesses always in frame (P6).<br>- Unified result order, streak rule, units ("x / 1,000") and Skip/Give up across the 6 games.<br>- Keyboard play for map rounds (arrow-key cursor + Enter, or a "type a place" alternative) | MEDIUM |
| **6** | **Engines + wave 1 games** | - Engines: Pick, Order, Name, Pin generalized.<br>- Daily + Practice modes.<br>- Ship the LOW games: **Lifelines, Clue Ladder, Born Here, Could They Have Met?, Earlier or Later, Same Year, Pin the City, Click the Country, Type the Countries, Flag Peek, Higher or Lower, Border Chain** (12).<br>- Image licence metadata in all pipelines | MEDIUM |
| **7** | **"Today's Five" and UTC day** | - Server-defined UTC day with a migration of existing saves.<br>- Daily schedule across the catalogue; countdown; recap share card (`ImageResponse`).<br>- Unified streak (server) + freezes | MEDIUM |
| **8** | **Account hardening and safety** | - E-mail provider; verification; password reset; generic sign-up errors.<br>- Rate limits on join, boards, profiles and renames.<br>- Block, report, word filter, reserved names; admin flag + simple moderation view.<br>- Legal pages; off-site backups | MEDIUM |
| **9** | **Server-side progression** | - XP, levels, achievements, discoveries in the API; local logbook import.<br>- All modes earn XP.<br>- Leaderboard caching | HIGH |
| **10** | **Social v2** | - `/u/[username]` profiles with OG cards, privacy settings, actions.<br>- Inbox; server-stored challenge links with sender and score; async duels.<br>- Invite and referral links.<br>- Web Push notifications (streak at risk, invites, challenges) | MEDIUM |
| **11** | **Leagues and Weekly Special** | - Weekly leagues with tiers, promotion and relegation.<br>- Country scope.<br>- Weekly Special puzzle + board | MEDIUM |
| **12** | **Parties v2** | - SSE transport direct to the API host.<br>- Host migration, ban list, join confirm, ready checks, presets, reactions, rematch, Quick Play.<br>- Seat count from plan (prepared for §7) | HIGH |
| **13** | **Entitlements (soft gates)** | - Schema migration (§7.3), `shared/plans.ts`, `/me` features and limits, `requireFeature` + 402.<br>- `useEntitlements`, `<Gate>`, `ProTeaser`, `ProSheet`.<br>- Practice allowance via `/practice/start`.<br>- Pricing page (no checkout); plan section in Account.<br>- Admin "grant Pro" for testing | MEDIUM |
| **14** | **Server-dealt puzzles and grading** | - Rosters out of the bundle; `/puzzles/:game/:day`; archive gate.<br>- Shared `rules` package; the server recomputes scores from moves; "verified" boards | HIGH |
| **15** | **Wave 2 games** | **Timeline, Year Snap, Landmark Lens, True Size, Rivers & Ranges, Life Tracks, Quickplay/Gauntlet** | MEDIUM |
| **16** | **Wave 3 games** | **Snapshot** (flagship Who·When·Where photo game), **Then & Now** (after a licence review) | HIGH |
| **17** | *(later, out of scope)* **Payments** | Billing adapter (Stripe and/or Mercado Pago with Pix), checkout, webhooks, customer portal, receipts, promo codes, tax | HIGH |
| **18** | *(later)* **Clubs, community quizzes, classroom mode** | | HIGH |

**Suggested order of value:**
- 0 → 1 → 2 → 3 is the foundation; most visible change comes with 4 and 5.
- 6 is the "many games" moment.
- 7–12 build the social habit loop.
- 13–14 make subscriptions possible.

**Parallel tracks:** 8 can run in parallel with 4–6 if a second person works on the API. Phases 6 and 15 parallelize per game once phase 3 exists.

---

## 9. Summary

### Top 10 problems
1. **The architecture can't take "many more games".** Each new game touches 12–15 files. The layout, hub and expedition import every game, so every page grows with each one. There is no catalogue, no families and no search (§2.9, §2.2).
2. **Nothing can be gated or trusted on the server.** Puzzles are picked on the device from the local date, every answer ships in the bundle, and scores are taken on trust. This blocks a paywall, an archive and fair leaderboards (§2.7, §7.4).
3. **The look is far from the target.** Editorial paper/print with icon-only navigation, tiny mono labels, text-only cards, inconsistent page widths and cream "misregistered" shadows in dark mode. Tailwind is installed but unused next to about 5,000 lines of global CSS (§2.1, §4).
4. **Accessibility failures.** Muted and red text at 2.95–4.05:1, heat colours at about 2.8:1, map rounds that need a mouse, 34 px targets, colour-only meters, unnamed dialogs (§2.1, §2.3).
5. **Mobile play friction.** The primary action is below the fold (Dig Site, Wayfarer), the map traps scrolling, rotation resets the map, and result maps hide the player's own guesses (§2.3).
6. **Party and expedition bugs that break the social loop.** Challenge links are ignored after one run, a host can wipe a live race, away players count as done, there is no host migration, kicked players rejoin, and the chat overflows (§2.6).
7. **Account basics are missing for a paid product.** No password reset, no e-mail verification, and the rate limiting probably shares one IP bucket across the whole site (§2.7).
8. **No moderation tools.** There is no block, report or filter, despite a global chat, public parties and open friend requests (§2.7).
9. **Progression is fragmented.** Logbook, levels and achievements are device-only, streaks are computed three different ways, and expedition and party play earn nothing (§2.6, §6.5).
10. **Performance and content polish.** About 494 KB of fonts per page, a 756 KB map file, client-only game pages, no code splitting. Wikipedia hatnotes in bios, Portuguese forced regardless of browser, "/4" in a 6-game day, "six tries" in 3-try expeditions, and no per-image licence attribution (§2.8, §2.4, §1.4).

### Roadmap at a glance

| Phase | Complexity |
|---|---|
| 0 Hotfixes | LOW |
| 1 Quick a11y and perf wins | LOW |
| 2 Design tokens and UI kit | MEDIUM |
| 3 Game platform refactor | HIGH |
| 4 App shell and catalogue | MEDIUM |
| 5 Game screen redesign | MEDIUM |
| 6 Engines + 12 new games | MEDIUM |
| 7 Today's Five + UTC day + unified streaks | MEDIUM |
| 8 Account hardening and safety | MEDIUM |
| 9 Server-side progression | HIGH |
| 10 Social v2 (profiles, inbox, challenges, push) | MEDIUM |
| 11 Leagues and Weekly Special | MEDIUM |
| 12 Parties v2 (SSE) | HIGH |
| 13 Entitlements (soft gates, pricing page) | MEDIUM |
| 14 Server-dealt puzzles and server grading | HIGH |
| 15 Wave 2 games (7) | MEDIUM |
| 16 Wave 3 games (Snapshot, Then & Now) | HIGH |
| 17 Payments *(later)* | HIGH |
| 18 Clubs, community quizzes, classroom *(later)* | HIGH |
