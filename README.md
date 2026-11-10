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

## How it is organised

| Path | What lives there |
| --- | --- |
| `lib/` | Shared base for every game: daily clock and schedule (`daily.ts`, `clock.ts`), localStorage state (`storage.ts`), streaks (`stats.ts`), EN/PT strings (`i18n.ts`), geography helpers (`geo.ts`), clipboard (`share.ts`) |
| `components/` | Shared UI: world map (`world-map.tsx`), year ruler (`year-dial.tsx`), the daily gate (`daily.tsx`), help and statistics panels (`game-panels.tsx`), share button and countdown (`result-footer.tsx`), header, hub card |
| `games/registry.ts` | The list of games shown on the hub |
| `games/<slug>/` | One game: its rules, saved progress and statistics (`store.ts`), strings (`messages.ts`), share text and UI |
| `scripts/` | Data pipelines; `scripts/lib/wiki.mjs` is the shared, cached Wikipedia/Wikidata client |
| `public/geo/` | World map (Natural Earth 1:50m, via the `world-atlas` package) |
| `public/people/`, `public/sites/` | Portraits and photos from Wikimedia Commons |

The puzzle is chosen on the player's device from their local date, so the pages are fully static. Day 1 is 10 November 2026 (`lib/daily.ts`). Each game plays through its whole roster once per cycle, in a shuffled order.

The world map draws markers, great-circle arcs, routes through waypoints, distance rings and tappable pins; a game only passes it data. Labels that would overlap are hidden until the player zooms in.

## Accounts and the API

Playing needs no account. Signing in (`/account`) keeps a player's games and streaks in their account and brings them to every device they use.

| Path | What lives there |
| --- | --- |
| `api/` | The accounts service: a small Node server (Hono) with a SQLite database. Its own `package.json`; runs TypeScript directly on Node 24+ |
| `api/src/app.ts` | Every route: sign up / in / out, the account's settings, saved games |
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

## Scoring

- **Who When Where** — four rounds worth up to 250 points each. Places score full marks within 20 km and fall off exponentially with distance; years fall off with every year of error (`games/who-when-where/rules.ts`).
- **Wayfarer** — six tries. A wrong guess says whether the real journey set out earlier or later, and reveals more of the route; the travel mode, century and stop names unlock along the way (`games/wayfarer/rules.ts`).
- **Dig Site** — five digs. Each returns the distance to the site; a dig within 50 km finds it (`games/dig-site/rules.ts`).
- **First to Last** — three tries. Events in the right position lock in place between tries (`games/first-to-last/rules.ts`).
