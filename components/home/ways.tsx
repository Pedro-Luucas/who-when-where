"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameTile } from "@/components/catalogue/game-tile";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { GAMES } from "@/games/registry";
import { useToday } from "@/games/today";
import { useShellT, type ShellKey } from "@/lib/shell-messages";

const WAYS: { href: string; title: ShellKey; blurb: ShellKey; icon: IconName; tone: string }[] = [
  { href: "/play", title: "modeSolo", blurb: "modeSoloBlurb", icon: "play", tone: "play" },
  { href: "/party", title: "modeParty", blurb: "modePartyBlurb", icon: "party", tone: "when" },
  { href: "/daily", title: "dailyGames", blurb: "modeDailyBlurb", icon: "calendar", tone: "who" },
  { href: "/expedition", title: "expedition", blurb: "modeExpeditionBlurb", icon: "compass", tone: "shapes" },
  { href: "/leaderboard", title: "navLeaderboard", blurb: "modeLeaderboardBlurb", icon: "trophy", tone: "pro" },
];

/** The ways to play, as tiles: solo, multiplayer, a party code, the dailies, a custom run, the leaderboard. */
export function WaysToPlay() {
  const t = useShellT();
  const router = useRouter();

  function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .trim()
      .toUpperCase();
    if (code) router.push(`/party?code=${encodeURIComponent(code)}&join=1`);
  }

  return (
    <section className="ways" aria-labelledby="ways-heading">
      <h2 id="ways-heading" className="section-heading">
        {t("waysToPlay")}
      </h2>
      <ul className="ways-grid">
        {WAYS.slice(0, 2).map((way) => (
          <Way key={way.href} {...way} />
        ))}
        <li className="way" data-tone="where">
          <span className="way-icon">
            <Icon name="link" />
          </span>
          <form className="way-join" onSubmit={join}>
            <label htmlFor="home-join-code" className="way-title">
              {t("modeJoin")}
            </label>
            <span className="way-join-row">
              <input
                id="home-join-code"
                name="code"
                placeholder={t("joinPlaceholder")}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                maxLength={8}
              />
              <button type="submit" className="key key-sm">
                {t("join")}
              </button>
            </span>
          </form>
        </li>
        {WAYS.slice(2).map((way) => (
          <Way key={way.href} {...way} />
        ))}
      </ul>
    </section>
  );
}

function Way({ href, title, blurb, icon, tone }: (typeof WAYS)[number]) {
  const t = useShellT();
  return (
    <li className="way" data-tone={tone}>
      <Link href={href}>
        <span className="way-icon">
          <Icon name={icon} />
        </span>
        <span className="way-title">{t(title)}</span>
        <span className="way-blurb">{t(blurb)}</span>
      </Link>
    </li>
  );
}

/** Every game as a tile, straight into its page. */
export function GamesGrid() {
  const t = useShellT();
  const { of } = useToday();
  return (
    <section className="home-games" aria-labelledby="home-games-heading">
      <header className="section-head">
        <div className="section-title">
          <h2 id="home-games-heading">
            {t("catalogueTitle")} <small>{GAMES.length}</small>
          </h2>
        </div>
        <Link href="/play" className="key key-secondary key-sm section-link">
          {t("browseAll")}
          <Icon name="chevron" size={15} />
        </Link>
      </header>
      <ul className="tiles">
        {GAMES.map((game, index) => (
          <li key={game.slug}>
            <GameTile game={game} index={index} today={of(game.slug)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
