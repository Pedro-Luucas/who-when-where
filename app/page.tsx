import { GameCard } from "@/components/game-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteText } from "@/components/site-text";
import { GAMES } from "@/games/registry";

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
            <div className="game-card game-card-soon">
              <h3>
                <SiteText k="comingSoon" />
              </h3>
              <p>
                <SiteText k="comingSoonBody" />
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
