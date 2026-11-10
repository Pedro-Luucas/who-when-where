# Who When Where

Daily guessing games about people, places and time. The first game, **Who When Where**, shows one famous mind a day and asks four questions: where and when they were born, where and when they died.

```bash
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run data:people  # rebuild the roster from Wikipedia/Wikidata
```

In development, `/who-when-where?day=N` plays day N's puzzle.

## How it is organised

| Path | What lives there |
| --- | --- |
| `lib/` | Shared base for every game: daily clock and schedule (`daily.ts`, `clock.ts`), localStorage state (`storage.ts`), EN/PT strings (`i18n.ts`), geography helpers (`geo.ts`) |
| `components/` | Shared UI: world map (`world-map.tsx`), year ruler (`year-dial.tsx`), modal, header, hub card |
| `games/registry.ts` | The list of games shown on the hub |
| `games/who-when-where/` | The game: rounds and scoring (`rules.ts`), saved progress and statistics (`store.ts`), strings (`messages.ts`), UI |
| `scripts/` | Data pipeline for the roster |
| `public/geo/` | World map (Natural Earth 1:50m, via the `world-atlas` package) |
| `public/people/` | Portraits from Wikimedia Commons |

The puzzle is chosen on the player's device from their local date, so the pages are fully static. Day 1 is 10 November 2026 (`lib/daily.ts`). Everyone in the roster is played once per cycle, in a shuffled order.

## Adding people

1. Add the English Wikipedia article title to `ROSTER` in `scripts/people-roster.mjs`.
2. Run `npm run data:people`. It prints one line per person; check the places and years.
3. If Wikidata points at a building or an odd label, add a correction to `OVERRIDES` in the same file and run again (`-- --no-images` skips the portrait downloads).

`games/who-when-where/data/people.json` is generated — don't edit it by hand. Changing the size of the roster reshuffles the schedule, so today's person may change when you deploy a new roster.

Descriptions are shown during play, so they must not give a place or a year away; the script strips "(1809–1882)"-style dates automatically.

## Adding a game

1. Create `games/<slug>/` with the game's component and logic. `lib/` and `components/` have the daily clock, storage, map and year ruler ready to reuse.
2. Add the route at `app/<slug>/page.tsx`.
3. List it in `games/registry.ts` so the hub shows it.

## Scoring

Each of the four rounds is worth up to 250 points (1,000 a day). Places score full marks within 20 km and fall off exponentially with distance; years fall off exponentially with every year of error. The constants are at the top of `games/who-when-where/rules.ts`.
