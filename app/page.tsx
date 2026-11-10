import { GameCard } from "@/components/game-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteText } from "@/components/site-text";
import { GAMES } from "@/games/registry";
import { DailyPanel } from "@/social/daily-panel";
import { SocialText } from "@/social/messages";
import Link from "next/link";

// Ways to play with other people, shown under the daily games.
const TOGETHER = [
  { href: "/expedition", name: "expedition", theme: "cardExpeditionTheme", blurb: "cardExpeditionBlurb", foot: "cardExpeditionFoot" },
  { href: "/party", name: "party", theme: "cardPartyTheme", blurb: "cardPartyBlurb", foot: "cardPartyFoot" },
  { href: "/leaderboard", name: "leaderboard", theme: "cardLeaderboardTheme", blurb: "cardLeaderboardBlurb", foot: "cardLeaderboardFoot" },
  { href: "/community", name: "community", theme: "cardCommunityTheme", blurb: "cardCommunityBlurb", foot: "cardCommunityFoot" },
] as const;

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="hub">
        <section className="hero">
          <h1 className="hero-title" aria-label="Who When Where">
            <span className="hero-line">
              <b>Who</b>
              <small>
                <SiteText k="heroWho" />
              </small>
            </span>
            <span className="hero-line">
              <b>When</b>
              <small>
                <SiteText k="heroWhen" />
              </small>
            </span>
            <span className="hero-line">
              <b>Where</b>
              <small>
                <SiteText k="heroWhere" />
              </small>
            </span>
          </h1>
          <p className="hero-lead">
            <SiteText k="hubLead" />
            <span>
              <SiteText k="hubLeadSub" />
            </span>
          </p>
        </section>

        <DailyPanel />

        <section aria-labelledby="games-heading">
          <h2 id="games-heading" className="eyebrow games-heading">
            <SiteText k="todaysGames" />
          </h2>
          <div className="games">
            {GAMES.map(({ Status, ...game }, index) => (
              <GameCard key={game.slug} game={game} index={index}>
                <Status />
              </GameCard>
            ))}
          </div>
        </section>

        <section className="together" aria-labelledby="together-heading">
          <h2 id="together-heading" className="eyebrow games-heading">
            <SocialText k="playTogether" />
          </h2>
          <div className="games">
            {TOGETHER.map((card, index) => (
              <Link key={card.href} href={card.href} className="game-card">
                <span className="game-card-theme">
                  <i>{String.fromCharCode(65 + index)}</i>
                  <SocialText k={card.theme} />
                </span>
                <h3>
                  <SocialText k={card.name} />
                </h3>
                <p>
                  <SocialText k={card.blurb} />
                </p>
                <div className="game-card-foot">
                  <span>
                    <SocialText k={card.foot} />
                  </span>
                  <strong>
                    <SocialText k="open" /> →
                  </strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
