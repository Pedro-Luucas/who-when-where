"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { fold } from "@/components/shell/search";
import { Icon } from "@/components/shell/nav-items";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { FAMILIES, FAMILY_IDS, type FamilyId } from "@/games/families";
import type { Engine } from "@/games/platform/definition";
import { GAMES, type GameSlug } from "@/games/registry";
import { useFavourites, useToday, type TodayState } from "@/games/today";
import { tap } from "@/lib/fx";
import { useLocale } from "@/lib/i18n";
import { WIDE, useMedia } from "@/lib/media";
import { useShellT } from "@/lib/shell-messages";
import { GameTile } from "./game-tile";
import { SetupPanel } from "./setup-panel";

type Tab = "all" | "favourites" | FamilyId;
type TodayFilter = "any" | "todo" | "done";
type EngineFilter = "any" | Engine;

const ENGINES = [...new Set(GAMES.map((game) => game.engine))];

/**
 * /play: every game, searchable and filtered by family, favourites, today's
 * progress and mechanic, with "Surprise me". Picking a game opens its setup
 * panel: beside the grid from the lg breakpoint, as a bottom sheet below it.
 */
export function Catalogue() {
  const t = useShellT();
  const locale = useLocale();
  const { of } = useToday();
  const [favourites, toggleFavourite] = useFavourites();
  const wide = useMedia(WIDE);
  const panelHeading = useId();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [todayFilter, setTodayFilter] = useState<TodayFilter>("any");
  const [engine, setEngine] = useState<EngineFilter>("any");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<GameSlug | null>(null);

  const q = fold(query.trim());
  const inTab = (slug: GameSlug, family: FamilyId) =>
    tab === "all" ? true : tab === "favourites" ? favourites.has(slug) : family === tab;
  const matchesToday = (state: TodayState) =>
    todayFilter === "any" || (todayFilter === "done" ? state === "done" : state !== "done");
  const shown = GAMES.filter(
    (game) =>
      inTab(game.slug, game.family) &&
      matchesToday(of(game.slug).state) &&
      (engine === "any" || game.engine === engine) &&
      (!q ||
        [game.title, game.blurb[locale], game.theme[locale], FAMILIES[game.family].name[locale]].some((text) =>
          fold(text).includes(q),
        )),
  );

  const families = FAMILY_IDS.map((id) => ({ id, count: GAMES.filter((game) => game.family === id).length })).filter(
    (family) => family.count > 0,
  );
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: t("all"), count: GAMES.length },
    { id: "favourites", label: t("favourites"), count: favourites.size },
    ...families.map((family) => ({ id: family.id, label: FAMILIES[family.id].name[locale], count: family.count })),
  ];
  const filtered = query.trim() !== "" || tab !== "all" || todayFilter !== "any" || engine !== "any";

  function clear() {
    setQuery("");
    setTab("all");
    setTodayFilter("any");
    setEngine("any");
  }

  function surprise() {
    const pool = shown.length ? shown : GAMES;
    // Prefer a puzzle still waiting today.
    const waiting = pool.filter((game) => of(game.slug).state !== "done");
    const from = waiting.length ? waiting : pool;
    const others = from.length > 1 ? from.filter((game) => game.slug !== selected) : from;
    setSelected(others[Math.floor(Math.random() * others.length)].slug);
  }

  const selectedGame = selected ? GAMES.find((game) => game.slug === selected) : undefined;
  const selectedIndex = selectedGame ? GAMES.indexOf(selectedGame) : -1;

  return (
    <div className="catalogue" data-panel={wide ? "" : undefined}>
      <div className="catalogue-main">
        <header className="section-head catalogue-head">
          <div className="section-title">
            <h1>
              {t("catalogueTitle")} <small>{GAMES.length}</small>
            </h1>
          </div>
          <p className="section-lead">{t("catalogueLead")}</p>
          <div className="catalogue-modes">
            <Link href="/expedition" className="key key-sm">
              <Icon name="compass" size={16} />
              {t("modeCustom")}
            </Link>
            <Link href="/party" className="key key-sm">
              <Icon name="party" size={16} />
              {t("navParty")}
            </Link>
          </div>
        </header>

        <div className="catalogue-tools">
          <label className="catalogue-search">
            <Icon name="search" />
            <span className="sr-only">{t("searchCatalogue")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchCatalogue")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="button" className="key key-secondary" onClick={surprise}>
            <Icon name="shuffle" />
            {t("surprise")}
          </button>
          <button
            type="button"
            className="key key-secondary"
            aria-expanded={filtersOpen}
            aria-controls="catalogue-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="filter" />
            {t("filters")}
            {(todayFilter !== "any" || engine !== "any") && <i className="badge">{Number(todayFilter !== "any") + Number(engine !== "any")}</i>}
          </button>
        </div>

        <div id="catalogue-filters" className="catalogue-filters" hidden={!filtersOpen}>
          <div>
            <span className="eyebrow">{t("filterToday")}</span>
            <Segmented
              label={t("filterToday")}
              options={[
                { value: "any", label: t("todayAny") },
                { value: "todo", label: t("todayTodo") },
                { value: "done", label: t("todayDone") },
              ]}
              value={todayFilter}
              onChange={setTodayFilter}
            />
          </div>
          <div>
            <span className="eyebrow">{t("filterEngine")}</span>
            <Segmented
              label={t("filterEngine")}
              options={[
                { value: "any" as EngineFilter, label: t("engineAny") },
                ...ENGINES.map((id) => ({ value: id as EngineFilter, label: t(`engine_${id}`) })),
              ]}
              value={engine}
              onChange={setEngine}
            />
          </div>
        </div>

        <div className="family-tabs" role="group" aria-label={t("familyTabs")}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={tab === entry.id}
              onClick={() => {
                if (entry.id !== tab) tap();
                setTab(entry.id);
              }}
              data-family={entry.id === "all" || entry.id === "favourites" ? undefined : entry.id}
            >
              {entry.id === "favourites" && <Icon name="star" size={15} />}
              {entry.label}
              <small>{entry.count}</small>
            </button>
          ))}
        </div>

        {shown.length ? (
          <ul className="tiles" aria-live="polite">
            {shown.map((game) => (
              <li key={game.slug}>
                <GameTile
                  game={game}
                  index={GAMES.indexOf(game)}
                  today={of(game.slug)}
                  selected={game.slug === selected}
                  onSelect={() => {
                    tap();
                    setSelected(game.slug === selected && !wide ? null : game.slug);
                  }}
                  favourite={{ on: favourites.has(game.slug), toggle: () => toggleFavourite(game.slug) }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="catalogue-empty" role="status">
            <p>{t("noGames")}</p>
            {filtered && (
              <button type="button" className="key key-secondary key-sm" onClick={clear}>
                {t("clearFilters")}
              </button>
            )}
          </div>
        )}
      </div>

      {wide ? (
        <aside className="setup-panel" aria-labelledby={selectedGame ? panelHeading : undefined}>
          {selectedGame ? (
            <SetupPanel key={selectedGame.slug} game={selectedGame} index={selectedIndex} headingId={panelHeading} />
          ) : (
            <div className="setup-empty">
              <Icon name="play" size={34} />
              <p>{t("pickAGame")}</p>
              <button type="button" className="key key-secondary" onClick={surprise}>
                <Icon name="shuffle" />
                {t("surprise")}
              </button>
            </div>
          )}
        </aside>
      ) : (
        selectedGame && (
          <Dialog
            open
            onClose={() => setSelected(null)}
            title={t("setupLabel", { game: selectedGame.title })}
            closeLabel={t("closePanel")}
            variant="sheet"
            className="setup-sheet"
          >
            <SetupPanel key={selectedGame.slug} game={selectedGame} index={selectedIndex} headingId={panelHeading} />
          </Dialog>
        )
      )}
    </div>
  );
}
