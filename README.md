# Who When Where

Daily guessing games about people, places and time, all played on a world map. Everyone gets the same puzzle each day.

| Game | Route | What you do |
| --- | --- | --- |
| **Who When Where** | `/play/who-when-where` | One famous mind a day: pin where they were born and died, and set the years. |
| **Wayfarer** | `/play/wayfarer` | A famous journey is traced on the map a stretch at a time. Name it in six tries. |
| **Dig Site** | `/play/dig-site` | A lost city is buried somewhere. Each dig draws a ring it lies on. Find it in five. |
| **First to Last** | `/play/first-to-last` | Six moments in history, pinned where they happened. Put them in order in three tries. |
| **Overland** | `/play/overland` | Two countries. Name the countries that join them, border to border, wasting as few guesses as you can. |
| **Outline** | `/play/outline` | A country, cut out of the map. Every miss says how far away it is, and which way. Name it in six. |

```bash
npm run dev            # http://localhost:3000
npm run build
npm run lint
npm run data:people    # rebuild Who When Where's roster from Wikipedia/Wikidata
npm run data:sites     # rebuild Dig Site's sites (and photos)
npm run data:journeys  # rebuild Wayfarer's journeys
npm run data:countries # rebuild the countries Overland and Outline are played with
npm run images         # redraw the app icons and the card shown for shared links
```

In development, `?day=N` on any game (or the home page) plays day N's puzzle.

The site is laid out after geocore.fun's "space HUD": a header with the main places as pills (Play, Daily, Leaderboard, Community, Party), search on the `/` key, a language chip and the account menu; a bottom bar on phones.

| Page | Route | What it is |
| --- | --- | --- |
| **Home** | `/` | A landing for guests, a dashboard once signed in (streak, level, today's points, the next puzzle waiting); today's dailies, the ways to play, every game. |
| **Games** | `/play` | The catalogue: today's dailies, then every game with an illustrated thumbnail, searchable and filtered by family, favourites, today's progress and mechanic, with "Surprise me". Picking one opens its setup panel (a bottom sheet on phones): how to play, options, the player's record, Play. |
| **Daily games** | `/daily` | Today's puzzle in every game, the day's progress and countdown, and the daily challenge below. |
| **A game** | `/play/<slug>` | The HUD bar (all games, round, pips, live numbers, Give up, how to play, statistics), the prompt plaque, the board, a sticky action bar on phones, and the result card with its answer-by-answer review. |

Around the daily games there is a community — all of it optional, none of it needed to play:

| Page | Route | What it is |
| --- | --- | --- |
| **Daily challenge** | `/daily` | Finish all six of today's puzzles. A year-long activity graph and day streaks, built from the games saved on the device; one button shares the whole day. |
| **Logbook** | `/logbook` | The player's level (every point is experience), 21 achievements, and an atlas: every person, journey, site, moment and country their puzzles revealed, pinned on one map. Built from the device's saves; no account needed. |
| **Expedition** | `/expedition` | A custom game: puzzles from any of the games, one after the other. The player picks the games, how many puzzles, the order, a clock and the difficulty. Solo, no account needed; a link challenges a friend to the very same puzzles. |
| **Party** | `/party` | A room (joined by code, invitation or the open list) where up to 12 players race through the same expedition, with live standings and chat. |
| **Leaderboard** | `/leaderboard` | Today, the last 7 days and all time; every game or one; everyone or friends. |
| **Community** | `/community` | Friends (requests, who is online, what they scored today), a global chat room and direct messages. |
| **Player** | `/player?u=<username>` | A public profile: totals, streaks, the activity graph, game-by-game averages. |

## How it is organised

| Path | What lives there |
| --- | --- |
| `lib/` | Shared base for every game: daily clock and schedule (`daily.ts`, `clock.ts`), localStorage state (`storage.ts`), streaks (`stats.ts`), EN/PT strings (`i18n.ts`), geography helpers (`geo.ts`), the countries and their borders (`countries.ts`), sharing (`share.ts`), the player's preferences (`prefs.ts`: theme, sound, vibration, confetti), sounds and confetti (`fx.ts`), notices (`toasts.ts`) |
| `components/` | Shared UI: world map (`world-map.tsx`), year ruler (`year-dial.tsx`), country search (`country-picker.tsx`), the daily gate (`daily.tsx`), help and statistics panels (`game-panels.tsx`), share button and countdown (`result-footer.tsx`, `share-button.tsx`), settings (`settings-button.tsx`), the header (`site-header.tsx`) and its parts (`shell/`: nav pills, search, language chip, account menu, bottom bar), the catalogue, dailies and setup panel (`catalogue/`), the home page (`home/`), each game's illustrated thumbnail (`game-art.tsx`), and the game screen's shared parts (`play/`: HUD, prompt plaque, result card) |
| `games/registry.ts` | Every game on the site, as plain data: the catalogue, the pages at `/play/<slug>`, sync, expeditions and parties all read this list. It loads no game |
| `games/loaders.tsx` | The one place the games themselves are imported from, each as its own chunk: a page that shows one game fetches that game only |
| `games/platform/` | What every game shares: the shape of a definition (`definition.ts`), of a game's data and board (`types.ts`), the daily page built around a board (`board.tsx`), and the saved-games hook (`store.ts`) |
| `games/<slug>/` | One game. `definition.ts`: its name, family, save and expedition settings, as plain data. `data.ts`: its roster and rules — dealing, scoring, what a finished puzzle reveals. `board.tsx`: its interface for the platform, around the `…Board` in `game.tsx` (one puzzle, with its moves held by whoever renders it), which both the daily page and expeditions play. Plus its rules (`rules.ts`), statistics (`store.ts`), strings (`messages.ts`) and share text |
| `games/results.ts` | Every game's finished days on one scale (`lib/points.ts`: up to 1,000 points a puzzle) — what the daily challenge, the activity graph and the leaderboards read. The scores are kept in an index beside the saves, so reading them loads no game |
| `expedition/` | The custom game: its rules (`settings.ts`), dealing the puzzles from a seed (`stages.ts`), the run being played (`run.ts`, `runner.tsx`), the set-up form and the solo page |
| `party/` | The party pages: the list (`party-page.tsx`), the room (`room.tsx`: lobby, race, chat), the standings |
| `logbook/` | The logbook: levels (`level.ts`), achievements (`achievements.ts`), what the player has discovered (`discoveries.ts`), the page, and `watcher.tsx` — mounted in the root layout, it answers every move and finished puzzle with a sound, confetti or a notice, so no game has to |
| `social/` | The community: API client (`client.ts`), polling (`remote.ts`, `pulse.ts`), friends, chat, leaderboard, profile, the hub's daily panel, and their EN/PT strings (`messages.ts`) |
| `scripts/` | Data pipelines; `scripts/lib/wiki.mjs` is the shared, cached Wikipedia/Wikidata client |
| `public/geo/` | World map (Natural Earth 1:50m, via the `world-atlas` package) |
| `public/people/`, `public/sites/` | Portraits and photos from Wikimedia Commons |

The puzzle is chosen on the player's device from their local date, so the pages are fully static. Day 1 is 10 November 2026 (`lib/daily.ts`). Each game plays through its whole roster once per cycle, in a shuffled order.

The world map draws markers, great-circle arcs, routes through waypoints, distance rings, tappable pins and whole countries coloured in; a game only passes it data. Labels that would overlap are hidden until the player zooms in.

## The phone UI

Phones (and small tablets held upright) get an interface of their own rather than a squeezed desktop page. Two queries decide, the same in CSS and in code:

| Name | Query | Where |
| --- | --- | --- |
| phone | `(max-width: 47.99rem)` | `PHONE` in `lib/media.ts`; the `@media` blocks of `app/mobile.css` |
| landscape | `(orientation: landscape) and (max-height: 31.25rem) and (max-width: 63.99rem)` | `PHONE_LANDSCAPE` in `lib/media.ts`; the same blocks |

- **Styling only differs:** `app/mobile.css`, loaded last, with every rule behind one of the two queries, so the desktop look is never touched. (`connect.css` and `pro.css` are written outside the cascade layers; the few phone overrides of them sit unlayered at the end of the file.)
- **Structure differs:** the component asks `useIsMobile()` (`lib/media.ts`) and renders its phone variant:
  - `components/shell/bottom-nav.tsx` — the tab bar (Home · Play · Daily · Social · Me), a side rail in landscape. "Me" opens `shell/me-sheet.tsx`, which stands in for the header's account popover (`shell/account-items.ts` feeds both).
  - `components/play/hud.tsx` — `PhoneHud`: one row (back, round and pips, menu); Skip, Give up, How to play, Statistics and Settings live in the menu's sheet. Game pages hide the site header and footer and fill the screen; the map takes what is left and the action bar sits at the bottom edge. In landscape the map fills the right of the screen.
  - `components/ui/dialog.tsx` — every dialog is a bottom sheet with a grip that can be dragged down to dismiss (search comes from the top instead).
  - `components/result-footer.tsx` — `ResultDock`: Share and the next puzzle, docked at the bottom of a finished puzzle.
  - `party/room.tsx` — during a race the room's key sits in the run bar and the standings and chat open as a sheet.
- **Touch:** controls are at least 44px, nothing depends on hover (the activity graph reads a day on tap), safe-area insets pad the header, bars, sheets and docks, and `tap()` in `lib/fx.ts` gives a short buzz where the player left vibration on.

## Accounts and the API

Playing needs no account. Signing in (`/account`) keeps a player's games and streaks in their account and brings them to every device they use. An account with a **username** (the public handle; the e-mail is never shown to others) can also take part in the community: leaderboards, friends, chat and parties.

| Path | What lives there |
| --- | --- |
| `api/` | The accounts service: a small Node server (Hono) with a SQLite database. Its own `package.json`; runs TypeScript directly on Node 24+ |
| `api/src/app.ts` | Sign up / in / out, the account's settings, saved games; wires in the groups below |
| `api/src/social.ts` | Scores (`PUT /results`), leaderboards, public profiles, player search, friends, and `GET /pulse` (what is waiting for the player) |
| `api/src/chat.ts` | The global room and direct messages between friends |
| `api/src/parties.ts` | Party rooms: members, settings, runs, scores, invitations, party chat |
| `api/src/challenges.ts` | Challenges: a finished expedition stored behind `/c/<id>` with the sender's score, played by anyone with the link or sent to one friend (a duel) |
| `api/src/notify.ts` | The inbox (`GET /inbox`: notifications and conversations) and Web Push subscriptions (`PUT`/`DELETE /push`) |
| `api/src/push.ts` | Web Push with `node:crypto` only: RFC 8291 payload encryption and RFC 8292 (VAPID) signing |
| `api/src/leagues.ts` | Weekly leagues (`GET /league`: groups of 30, Bronze to Diamond, promotion and relegation) and the Weekly Special's board |
| `api/src/reminders.ts` | "Your streak ends in 2 hours" pushes, after 22:00 UTC |
| `api/src/db.ts` | The schema, as a list of migrations. Append a new one to change it; never edit an old one |
| `api/deploy/` | `setup.sh` prepares a server once; `deploy.sh` ships the code |
| `account/` | The site's side: API client (`api.ts`), who is signed in (`state.ts`), save sync (`sync.ts`), the `/account` page |

```bash
npm --prefix api install   # once
npm run api:dev            # the API on http://127.0.0.1:4310, database in api/data/
npm run api:test
```

The site calls the API on its own origin, under `/api/…`, and Next forwards those requests to `API_ORIGIN` (`next.config.ts`). In development that defaults to the local API. For production, set `API_ORIGIN` to the API's address **when building** — the forwarding rule is fixed at build time:

```bash
API_ORIGIN=https://api.example.com SITE_URL=https://example.com npm run build
```

`SITE_URL` is the site's own public address: it goes into the link previews (the card in `app/opengraph-image.png`).

The site can be installed as an app (`app/manifest.ts`). The theme, sound, vibration and confetti are the player's to choose, in the settings behind the account menu (the avatar at the header's end); they stay on the device.

**How sign-in works.** Passwords are hashed with scrypt. A session is a random token in an `HttpOnly` cookie; the database stores only its hash. Sessions last 30 days and renew while in use. Changing the password signs the account out everywhere else.

**How saves sync.** Each puzzle a player starts is one row: `(account, game, day) → record`. A record's progress — how many moves it holds — only grows, so when two devices disagree the one further along wins. Games played before signing in are added to the account; signing out removes them from the device. Every game in `games/registry.ts` takes part: its definition names its save.

**How scores work.** Every game scores a finished puzzle from 0 to 1,000 (`scoreOf` in its `rules.ts`). A signed-in player's finished daily puzzles are sent to the API after each save sync; the first score sent for a day stands. The games are graded on the player's device, so the API takes scores on trust — the leaderboards are for fun, not for prizes.

**How the live parts work.** There are no sockets: pages poll. A party room asks how it stands every 2.5 s (one call returns the room, everyone's scores and the new chat), an open chat every 3 s, the header badge every 20 s — and none of them while the tab is hidden. This works through the `/api` forwarding on any host. A party's puzzles are never sent by the server: it stores a seed, and every player's page deals the same puzzles from it (`buildStages`).

**Social v2.** Public profiles live at `/u/<username>` (with a share card), and can be made friends-only or hide their presence; a player may show a flag, which also puts them on that flag's leaderboard. `/inbox` gathers challenges, friend requests and conversations. A finished expedition can be shared as a challenge (`/c/<id>`): the recipient sees the score to beat, plays the same puzzles, then gets the head-to-head and a rematch. Whoever signs up through an invitation link (`/i/<username>`) becomes the inviter's friend. `/league` is the weekly league; `/weekly` the Weekly Special, one longer run a week (`social/weekly-special.ts` rotates its themes). Every one of these pages says so plainly when the API in front of it predates them.

**Push notifications.** Off unless the API has a VAPID key pair. Make one with `node scripts/vapid-keys.ts` (in `api/`) and add the three lines it prints to `/etc/who-when-where/api.env` (`VAPID_SUBJECT` should be a real `mailto:` address), then restart the API. The site's service worker (`public/sw.js`) only shows notifications; players turn them on per device in `/inbox` or `/account`.

**Plans (Free / Pro).** Everything is free until a switch is turned on; there is no payment integration. The plan table (features, limits, display prices) and the site's switch live in `shared/plans.ts`: build with `NEXT_PUBLIC_PRO_GATING=preview` to show Pro chips, the Pricing pill and plan cards without locking anything, or `=on` for the soft gates (Pro games, the practice allowance, the archive window, locked expedition options). The API has its own switch, `PRO_GATING=on` in `/etc/who-when-where/api.env`, for what it enforces itself (402 `upgrade_required`, `POST /practice/start`, party seats 8/16; 12 for everyone while off). The API keeps a copy of the plan table in `api/src/plans.ts` (the tests check they match). Give an account Pro by hand with `node scripts/grant-pro.ts <username|email> [days|forever|off]` (in `api/`, with `DATABASE_PATH` set). `/pricing` compares the plans; `/account` shows the player's plan.

**Deploying the API.** On a fresh Ubuntu server with Node 24+, as root:

```bash
ssh <host> "DOMAIN=api.example.com bash -s" < api/deploy/setup.sh   # once
npm run api:deploy -- <host>                                         # every release
```

`setup.sh` creates a locked-down service user, systemd units for the API and a nightly database backup (kept 14 days in `/var/lib/who-when-where/backups`), installs Caddy for HTTPS and opens ports 80 and 443. The database is `/var/lib/who-when-where/app.db`; settings are in `/etc/who-when-where/api.env`. Logs: `journalctl -u who-when-where-api`.

## Where the data comes from

| Game | Source list (edit this) | Generated file (don't edit) |
| --- | --- | --- |
| Who When Where | `scripts/people-roster.mjs` | `games/who-when-where/data/people.json` |
| Dig Site | `scripts/sites-roster.mjs` | `games/dig-site/data/sites.json` |
| Wayfarer | `scripts/journeys-roster.mjs` | `games/wayfarer/data/journeys.json` |
| First to Last | `games/first-to-last/events.ts` | — |
| Overland, Outline | the tables in `scripts/build-countries.mjs` | `lib/data/countries.json` |

**People.** Add the English Wikipedia article title to `ROSTER` and run `npm run data:people`. It prints one line per person; check the places and years. If Wikidata points at a building or an odd label, add a correction to `OVERRIDES` (`-- --no-images` skips the portrait downloads). Descriptions are shown during play, so they must not give a place or a year away.

**Sites.** Each entry is a Wikipedia title plus a hand-written era and clue in both languages. Coordinates, names, country, photo and the closing text come from Wikipedia. The clue is shown while the player is still searching: it must never name the site, its country or a nearby city. Sites without a photo are skipped.

**Journeys.** Routes are drawn by hand as a list of `[lat, lon]` waypoints; give a waypoint a name to make it a labelled stop. They are schematic — good enough to recognise on a world map. The closing text and link come from Wikipedia.

**Events.** One line each: year, coordinates, what happened and where, in both languages. The name must not give the year away. Each day's six are dealt from a shuffle so that no two are less than 5 years or 2,500 km apart.

**Countries.** Shapes, borders, sizes and centres are worked out from the world map the site ships (`public/geo/countries-50m.json`); names come from the runtime's CLDR data, so `npm run data:countries` needs no network. The script's tables say which shapes are countries, which belong to another (Somaliland, Hong Kong…), which names to prefer and what else a player may type ("USA", "Holland"). Overland plays crossings with two to six countries between the ends; Outline keeps countries under 2,500 km² as guesses only.

Changing the size of a roster reshuffles that game's schedule, so today's puzzle may change when you deploy new data. A day the player has already started keeps its puzzle.

## Adding a game

1. Create `games/<slug>/` with three modules:
   - `definition.ts` — `defineGame({ slug, title, theme, blurb, family, engine, save, status, expedition })`. Plain data, no imports of the game.
   - `data.ts` — `defineData(slug, { puzzleForDay, deal, puzzleOf, score, resultOf, answer, discover, totals, … })`: the roster and the rules, scored 0–1,000 (`lib/points.ts`).
   - `board.tsx` — `defineBoard(definition, { data, Board, messages, daily, share, stats })`: the board one puzzle is played on, and the words and statistics of its daily page. The platform adds the saving, the result footer, the help and statistics panels. A board renders the shared screen parts from `components/play/`: `Hud` (round, pips, Give up through `onMoves`), `Plaque` (the prompt) and, once the puzzle is over, `ResultCard` (points of 1,000, a few numbers, the answer-by-answer review), then its map and reading. Give it a thumbnail scene in `components/game-art.tsx` (without one it shows its family's mark).
2. List the definition at the end of `games/registry.ts`, and name the game's modules in `games/loaders.tsx`.
3. Add the slug to `GAMES` in `api/src/validate.ts` (and its tries, if it has any, to `TRIES`), and deploy the API before the site sends it scores of the new game.

That is all: the catalogue tile, the dailies, the page at `/play/<slug>`, account sync, the daily challenge, leaderboards, expeditions, parties and the logbook's atlas pick the game up from its definition. (A game that reveals a new kind of thing also names it in `DISCOVERY_KINDS` and the logbook's strings.)

## Scoring

- **Who When Where** — four rounds worth up to 250 points each. Places score full marks within 20 km and fall off exponentially with distance; years fall off with every year of error (`games/who-when-where/rules.ts`).
- **Wayfarer** — six tries. A wrong guess says whether the real journey set out earlier or later, and reveals more of the route; the travel mode, century and stop names unlock along the way (`games/wayfarer/rules.ts`).
- **Dig Site** — five digs. Each returns the distance to the site; a dig within 50 km finds it (`games/dig-site/rules.ts`).
- **First to Last** — three tries. Events in the right position lock in place between tries (`games/first-to-last/rules.ts`).
- **Overland** — as many guesses as the shortest way needs, plus four. Each country named is on a shortest route, one border out of the way, or off course; the crossing is made when the named countries join the two ends (`games/overland/rules.ts`).
- **Outline** — six guesses. A miss gives the distance and direction between the two countries' centres; the hemispheres, the size and the number of neighbours unlock along the way (`games/outline/rules.ts`).

For leaderboards, the daily challenge and expeditions, every puzzle is also worth up to 1,000 points (`lib/points.ts`): Who When Where's own score; in the others, 1,000 for solving on the first try down to 250 on the last (in Overland, 1,000 for the shortest way down to 250 with every spare guess spent), and a small consolation for a near miss.
