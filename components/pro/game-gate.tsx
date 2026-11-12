"use client";

import { GameSkeleton } from "@/components/daily";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { gameBySlug, type GameSlug } from "@/games/registry";
import { GATING } from "@/shared/plans";
import { Gate, ProTeaser } from "./gate";
import { useProT } from "./messages";

/** A game's page, behind its Pro gate when it is a Pro game and gating is on. */
export function ProGameGate({ game, children }: { game: GameSlug; children: React.ReactNode }) {
  const t = useProT();
  const definition = gameBySlug(game);
  if (GATING !== "on" || definition.tier !== "pro") return children;
  return (
    <Gate
      feature="games.pro"
      loading={<GameSkeleton />}
      fallback={
        <main className="shell-page pro-gate-page">
          <ProTeaser
            feature="games.pro"
            title={t("proGameTitle", { game: definition.title })}
            body={t("proGameBody")}
            actions={
              <ButtonLink href="/daily" variant="secondary" icon={<Icon name="calendar" size={17} />}>
                {t("backToDailies")}
              </ButtonLink>
            }
          />
        </main>
      }
    >
      {children}
    </Gate>
  );
}
