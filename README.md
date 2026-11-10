# Who When Where

Daily guessing games about people, places and time, all played on a world map. Everyone gets the same puzzle each day.

| Game | Route | What you do |
| --- | --- | --- |
| **Who When Where** | `/who-when-where` | One famous mind a day: pin where they were born and died, and set the years. |
| **Wayfarer** | `/wayfarer` | A famous journey is traced on the map a stretch at a time. Name it in six tries. |
| **Dig Site** | `/dig-site` | A lost city is buried somewhere. Each dig draws a ring it lies on. Find it in five. |
| **First to Last** | `/first-to-last` | Six moments in history, pinned where they happened. Put them in order in three tries. |

```bash
npm run dev            # http://localhost:3000
npm run build
npm run lint
npm run data:people    # rebuild Who When Where's roster from Wikipedia/Wikidata
npm run data:sites     # rebuild Dig Site's sites (and photos)
npm run data:journeys  # rebuild Wayfarer's journeys
```

In development, `?day=N` on any game (or the hub) plays day N's puzzle.

Around the daily games there is a community — all of it optional, none of it needed to play:

| Page | Route | What it is |
| --- | --- | --- |
| **Daily challenge** | `/` | Finish all four of today's puzzles. A year-long activity graph and day streaks, built from the games saved on the device. |
| **Expedition** | `/expedition` | A custom game: puzzles from any of the games, one after the other. The player picks the games, how many puzzles, the order, a clock and the difficulty. Solo, no account needed; a link challenges a friend to the very same puzzles. |
| **Party** | `/party` | A room (joined by code, invitation or the open list) where up to 12 players race through the same expedition, with live standings and chat. |
| **Leaderboard** | `/leaderboard` | Today, the last 7 days and all time; every game or one; everyone or friends. |
| **Community** | `/community` | Friends (requests, who is online, what they scored today), a global chat room and direct messages. |
| **Player** | `/player?u=<username>` | A public profile: totals, streaks, the activity graph, game-by-game averages. |

## How it is organised

| Path | What lives there |
| --- | --- |
| `lib/` | Shared base for every game: daily clock and schedule (`daily.ts`, `clock.ts`), localStorage state (`storage.ts`), streaks (`stats.ts`), EN/PT strings (`i18n.ts`), geography helpers (`geo.ts`), clipboard (`share.ts`) |
| `components/` | Shared UI: world map (`world-map.tsx`), year ruler (`year-dial.tsx`), the daily gate (`daily.tsx`), help and statistics panels (`game-panels.tsx`), share button and countdown (`result-footer.tsx`), header, hub card |
| `games/registry.ts` | The list of games shown on the hub |
| `games/<slug>/` | One game: its rules, saved progress and statistics (`store.ts`), strings (`messages.ts`), share text and UI. `game.tsx` exports a `…Board` — one puzzle, with its moves held by whoever renders it — which both the daily page and expeditions play |
| `games/results.ts` | Every game's finished days on one scale (`lib/points.ts`: up to 1,000 points a puzzle) — what the daily challenge, the activity graph and the leaderboards read |
| `expedition/` | The custom game: its rules (`settings.ts`), dealing the puzzles from a seed (`stages.tsx`), the run being played (`run.ts`, `runner.tsx`), the set-up form and the solo page |
| `party/` | The party pages: the list (`party-page.tsx`), the room (`room.tsx`: lobby, race, chat), the standings |
| `social/` | The community: API client (`client.ts`), polling (`remote.ts`, `pulse.ts`), friends, chat, leaderboard, profile, the hub's daily panel, and their EN/PT strings (`messages.ts`) |
| `scripts/` | Data pipelines; `scripts/lib/wiki.mjs` is the shared, cached Wikipedia/Wikidata client |
| `public/geo/` | World map (Natural Earth 1:50m, via the `world-atlas` package) |
| `public/people/`, `public/sites/` | Portraits and photos from Wikimedia Commons |

The puzzle is chosen on the player's device from their local date, so the pages are fully static. Day 1 is 10 November 2026 (`lib/daily.ts`). Each game plays through its whole roster once per cycle, in a shuffled order.

The world map draws markers, great-circle arcs, routes through waypoints, distance rings and tappable pins; a game only passes it data. Labels that would overlap are hidden until the player zooms in.

## Accounts and the API

Playing needs no account. Signing in (`/account`) keeps a player's games and streaks in their account and brings them to every device they use. An account with a **username** (the public handle; the e-mail is never shown to others) can also take part in the community: leaderboards, friends, chat and parties.

| Path | What lives there |
| --- | --- |
| `api/` | The accounts service: a small Node server (Hono) with a SQLite database. Its own `package.json`; runs TypeScript directly on Node 24+ |
| `api/src/app.ts` | Sign up / in / out, the account's settings, saved games; wires in the groups below |
| `api/src/social.ts` | Scores (`PUT /results`), leaderboards, public profiles, player search, friends, and `GET /pulse` (what is waiting for the player) |
| `api/src/chat.ts` | The global room and direct messages between friends |
| `api/src/parties.ts` | Party rooms: members, settings, runs, scores, invitations, party chat |
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
API_ORIGIN=https://api.example.com npm run build
```

**How sign-in works.** Passwords are hashed with scrypt. A session is a random token in an `HttpOnly` cookie; the database stores only its hash. Sessions last 30 days and renew while in use. Changing the password signs the account out everywhere else.

**How saves sync.** Each puzzle a player starts is one row: `(account, game, day) → record`. A record's progress — how many moves it holds — only grows, so when two devices disagree the one further along wins. Games played before signing in are added to the account; signing out removes them from the device. A game takes part by exporting `SYNC` from its `store.ts` and being listed in `games/saves.ts`.

**How scores work.** Every game scores a finished puzzle from 0 to 1,000 (`scoreOf` in its `rules.ts`). A signed-in player's finished daily puzzles are sent to the API after each save sync; the first score sent for a day stands. The games are graded on the player's device, so the API takes scores on trust — the leaderboards are for fun, not for prizes.

**How the live parts work.** There are no sockets: pages poll. A party room asks how it stands every 2.5 s (one call returns the room, everyone's scores and the new chat), an open chat every 3 s, the header badge every 20 s — and none of them while the tab is hidden. This works through the `/api` forwarding on any host. A party's puzzles are never sent by the server: it stores a seed, and every player's page deals the same puzzles from it (`buildStages`).

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

**People.** Add the English Wikipedia article title to `ROSTER` and run `npm run data:people`. It prints one line per person; check the places and years. If Wikidata points at a building or an odd label, add a correction to `OVERRIDES` (`-- --no-images` skips the portrait downloads). Descriptions are shown during play, so they must not give a place or a year away.

**Sites.** Each entry is a Wikipedia title plus a hand-written era and clue in both languages. Coordinates, names, country, photo and the closing text come from Wikipedia. The clue is shown while the player is still searching: it must never name the site, its country or a nearby city. Sites without a photo are skipped.

**Journeys.** Routes are drawn by hand as a list of `[lat, lon]` waypoints; give a waypoint a name to make it a labelled stop. They are schematic — good enough to recognise on a world map. The closing text and link come from Wikipedia.

**Events.** One line each: year, coordinates, what happened and where, in both languages. The name must not give the year away. Each day's six are dealt from a shuffle so that no two are less than 5 years or 2,500 km apart.

Changing the size of a roster reshuffles that game's schedule, so today's puzzle may change when you deploy new data. A day the player has already started keeps its puzzle.

## Adding a game

1. Create `games/<slug>/` with the game's component and logic. Wrap it in `<Daily>` and reuse the map, panels and result footer from `components/`.
2. Add the route at `app/<slug>/page.tsx`.
3. List it in `games/registry.ts` so the hub shows it.
4. Export `SYNC` from its `store.ts` and add it to `games/saves.ts`, so signed-in players keep their games.
5. To make it count in the daily challenge, leaderboards and expeditions: give `rules.ts` a `scoreOf` (0–1,000), export `resultOf` from `store.ts` and a `…Board` from `game.tsx`, then add the slug to `games/slugs.ts`, `games/results.ts`, `expedition/stages.tsx` and `GAMES` in `api/src/validate.ts`.

## Scoring

- **Who When Where** — four rounds worth up to 250 points each. Places score full marks within 20 km and fall off exponentially with distance; years fall off with every year of error (`games/who-when-where/rules.ts`).
- **Wayfarer** — six tries. A wrong guess says whether the real journey set out earlier or later, and reveals more of the route; the travel mode, century and stop names unlock along the way (`games/wayfarer/rules.ts`).
- **Dig Site** — five digs. Each returns the distance to the site; a dig within 50 km finds it (`games/dig-site/rules.ts`).
- **First to Last** — three tries. Events in the right position lock in place between tries (`games/first-to-last/rules.ts`).

For leaderboards, the daily challenge and expeditions, every puzzle is also worth up to 1,000 points (`lib/points.ts`): Who When Where's own score; in the other three, 1,000 for solving on the first try down to 250 on the last, and a small consolation for a near miss.
