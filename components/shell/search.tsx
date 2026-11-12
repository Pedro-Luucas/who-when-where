"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { GameArt } from "@/components/game-art";
import { Dialog } from "@/components/ui/dialog";
import { FAMILIES } from "@/games/families";
import { GAMES } from "@/games/registry";
import { useLocale } from "@/lib/i18n";
import { useShellT, type ShellKey } from "@/lib/shell-messages";
import { Icon, type IconName } from "./nav-items";

// The header's search: games and pages, opened with the button or the "/"
// key, walked with the arrow keys, opened with Enter.

/** "Tânger" matches "tanger". */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const PAGES: { href: string; label: ShellKey; icon: IconName }[] = [
  { href: "/", label: "navHome", icon: "home" },
  { href: "/play", label: "navPlay", icon: "play" },
  { href: "/daily", label: "navDaily", icon: "calendar" },
  { href: "/leaderboard", label: "navLeaderboard", icon: "trophy" },
  { href: "/community", label: "navCommunity", icon: "people" },
  { href: "/party", label: "navParty", icon: "party" },
  { href: "/expedition", label: "expedition", icon: "compass" },
  { href: "/logbook", label: "logbook", icon: "book" },
  { href: "/account", label: "account", icon: "user" },
  { href: "/pricing", label: "navPricing", icon: "crown" },
];

type Hit = { href: string; title: string; note: string; game?: (typeof GAMES)[number]; icon?: IconName };

/** Whether a key press is someone typing into a field (where "/" must stay a slash). */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function SearchButton() {
  const t = useShellT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" className="search-button" onClick={() => setOpen(true)} aria-label={t("searchLabel")} aria-keyshortcuts="/">
        <Icon name="search" size={17} />
        <span className="search-button-text">{t("search")}</span>
        <kbd aria-hidden="true">/</kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const t = useShellT();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  // The dialog gives its title the focus as it opens (its effect runs first);
  // here typing should start at once.
  useEffect(() => input.current?.focus(), []);

  const q = fold(query.trim());
  const games: Hit[] = GAMES.filter(
    (game) =>
      !q ||
      [game.title, game.blurb[locale], game.theme[locale], FAMILIES[game.family].name[locale]].some((text) =>
        fold(text).includes(q),
      ),
  ).map((game) => ({
    href: `/play/${game.slug}`,
    title: game.title,
    note: `${FAMILIES[game.family].name[locale]} · ${game.theme[locale]}`,
    game,
  }));
  const pages: Hit[] = PAGES.filter((page) => !q || fold(t(page.label)).includes(q)).map((page) => ({
    href: page.href,
    title: t(page.label),
    note: page.href,
    icon: page.icon,
  }));
  const hits = [...games, ...pages];
  const current = Math.min(active, Math.max(hits.length - 1, 0));

  function go(hit: Hit | undefined) {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + hits.length) % Math.max(hits.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(hits[current]);
    }
  }

  const option = (hit: Hit, index: number) => (
    <li
      key={hit.href}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={index === current}
      className="search-hit"
      onPointerMove={() => setActive(index)}
      onClick={() => go(hit)}
    >
      {hit.game ? (
        <GameArt slug={hit.game.slug} family={hit.game.family} className="search-hit-art" />
      ) : (
        <span className="search-hit-icon">
          <Icon name={hit.icon ?? "chevron"} />
        </span>
      )}
      <span className="search-hit-text">
        <b>{hit.title}</b>
        <small>{hit.note}</small>
      </span>
      <Icon name="chevron" size={16} />
    </li>
  );

  return (
    <Dialog open onClose={onClose} title={t("search")} closeLabel={t("closePanel")} className="search-dialog">
      <div className="search-field">
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={hits.length ? `${listId}-${current}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul id={listId} role="listbox" aria-label={t("searchLabel")} className="search-hits">
        {games.length > 0 && (
          <li role="presentation" className="search-group">
            {t("searchGames")}
          </li>
        )}
        {games.map((hit, i) => option(hit, i))}
        {pages.length > 0 && (
          <li role="presentation" className="search-group">
            {t("searchPages")}
          </li>
        )}
        {pages.map((hit, i) => option(hit, games.length + i))}
      </ul>
      {hits.length === 0 && <p className="hint">{t("searchNoMatch", { q: query.trim() })}</p>}
      <p className="search-keys" aria-hidden="true">
        {t("searchKeys")}
      </p>
    </Dialog>
  );
}
