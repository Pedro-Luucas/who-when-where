# Visual audit (browser walkthrough, 2026-11-11)

## Who When Where — top UX problems
1. First visit to / showed the Who When Where game (tab title "Who When Where · Who When Where") instead of the hub; later visits show the hub. New visitors never see the hub first.
2. Q1 result map has a large empty parchment strip at the top; map doesn't reframe to fit guess+answer.
3. Full-page screenshots show a colour seam (lighter lower half) — background height issue.
4. Map is small; clicks that miss it do nothing with no hint.
5. Year question pre-filled with 1700 and confirm enabled immediately (stray click submits 1700).
6. Scoring steep and opaque: 5,166 km = 2/250; "+2 pts" stamp shows no max; year "±28" has no scale.
7. Settings dialog always present in DOM (a11y issue — screen readers/queries find it on Overland/Outline).
8. Party and Comunidade show identical sign-up walls; Party isn't explained.
9. Sign-up shown before login everywhere; "Já tem conta? Entre" is a tiny link.
10. How-to modal on every game's first visit covers the game; close "×" is tiny.
11. Header icons are icon-only, cryptic, and change between pages.
12. Narrow widths only roughly tested; needs real phone layout.
13. Tiny low-contrast monospace labels, worse in dark mode.
14. Ranking nearly empty (one user) — looks unfinished; needs seeded/empty states.
15. Duplicate tab title; PT default with gaps.
Current games: Who When Where (person: born where/when, died where/when), Wayfarer (journey route), Dig Site (find buried site, 5 digs), First to Last (order 6 events), Overland (countries between two countries), Outline (country silhouette). Modes: Expedição custom session, Party (12, account), Ranking, Comunidade, logbook with 21 achievements, levels, streaks. No monetization.
Current look: parchment/editorial atlas, serif headings, offset shadows; dark navy mode.

## geocore.fun — reference
- ~157 games + 2,200 map quizzes; families colour-coded: Map (blue), Shapes & borders (teal), Flags (periwinkle), Words & puzzles (purple), Numbers & facts (pink), Street-level.
- Play hub: daily games carousel on top, searchable game grid with thumbnails and status chips (UNLIMITED, 1 LEFT TODAY, ACCOUNT, Pro); selecting a game opens a collapsible right-hand setup panel (Region, Which countries, # questions, Countdown, Mark found, Next question). "More info" modal tabs: How to play, Settings, Display & controls, Scoring, Your stats.
- Gameplay: full-bleed 3D globe, HUD pill bar on top (round counter, score, streak, timer, Pause, Skip, End, Hint, Info), "FIND THIS COUNTRY" plaque top centre, wrong-guess red pill, 3 tries, hint toast.
- Results: "Game over" card, points/1500, correct/missed/accuracy/time/best combo, answer-by-answer review, "What you missed", Play again / Today's daily / Create challenge, upsell "Study with Pro", "Save your scores".
- Dailies page: 5 free dailies, weekly special, streak dial, archive calendar. Leaderboards: Global XP, Total Mastery, Weekly league, Clubs, Nations, per-game.
- Palette (from CSS): bg #01040B #040914 #07111F #0A1727 #0D2032 #123653; text #EDFAFF #A9C6D8 #6F91A7; accents #4FABF6 #1E72E8 #0D4FC4 #5FD8FF; gold #FFD45C; danger #FF466D; success #3EF08A; purple #B07CFF; teal #2DD4BF; periwinkle #818CF8. Primary button gradient #1A62C8→#1553AD edge #7CC0FF; Pro tag gradient #FFE89A→#E5A722 ink #1C1302; Play green ink #137A3F. Glass navy cards with cyan 28% borders, chunky 3D key buttons.
- Fonts: Chakra Petch (UI/labels), Bricolage Grotesque (display), JetBrains Mono.
- Nav: sticky top bar, pill nav (Play, Quizzes, Community, Products ▾, Pricing with "−65%" chip, Explore ▾), search with "/" shortcut, language chip, Log in, blue "Create free account"; slim promo banner; big footer.
- Monetization: Pro $4.99/mo or $29.99/yr (sale $20.99 first yr). Free: 5 games/day, today's dailies only, lobbies of 8, 1 game review/day, no AI/satellite/cosmetics. Pro: unlimited, 25 Pro-only games, archive dailies, lobbies 16, cosmetics (frames, banners, name styles), no ads, +10% league points. Guests can only play "unlimited" games.
Screenshots: docs/visual-audit/wwww and docs/visual-audit/geocore (geocore-index.css included).
