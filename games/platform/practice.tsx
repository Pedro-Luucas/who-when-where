"use client";

import { Suspense, use, useState } from "react";
import { browser } from "react-dom";
import { useEntitlements } from "@/account/entitlements";
import { usePracticeAllowance } from "@/account/practice-allowance";
import { GameSkeleton } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ProTeaser } from "@/components/pro/gate";
import { useProT } from "@/components/pro/messages";
import { Icon } from "@/components/shell/nav-items";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { usePersistent } from "@/lib/storage";
import { LIMITS } from "@/shared/plans";
import { loadBoard } from "../loaders";
import { gameBySlug, type GameSlug } from "../registry";
import { GameFrameProvider } from "./frame";
import { useGameSave } from "./store";

// Practice: as many puzzles as the player likes, dealt at random from the
// whole roster (or from one variant of it: a region, a measure). Nothing here
// counts towards the daily challenge, streaks or leaderboards. With the plans
// switch on (shared/plans.ts) it has a daily allowance outside Pro: a puzzle
// counts at its first move, and once the day's are used the next one is not
// dealt (account/practice-allowance.ts, AUDIT_AND_PLAN §7.5).
//
// The puzzle in play is kept on the device, so a reload carries on with it.

type PracticeState = {
  /** Deals the puzzle on screen. */
  seed: string;
  /** The variant it was dealt from ("" for the game's default). */
  variant: string;
  moves: unknown[];
  /** Practice puzzles started so far, this one included. */
  count: number;
};

const NONE: PracticeState | null = null;

const isPracticeState = (value: unknown): boolean => {
  if (value === null) return true;
  const state = value as PracticeState;
  return (
    typeof state === "object" &&
    typeof state.seed === "string" &&
    typeof state.variant === "string" &&
    Array.isArray(state.moves) &&
    typeof state.count === "number"
  );
};

function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

/** A game's practice page. Fetches that game, and no other. */
export function PracticeScreen({ game }: { game: GameSlug }) {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <Practice game={game} />
    </Suspense>
  );
}

function Practice({ game }: { game: GameSlug }) {
  use(browser("Practice puzzles are dealt at random, in the browser."));
  const board = use(loadBoard(game));
  const definition = gameBySlug(game);
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(board.messages, locale);
  const words = board.daily(t);
  const [save, setSave] = useGameSave<unknown>(definition);
  const [stored, setStored] = usePersistent<PracticeState | null>(`practice:${game}:v1`, NONE, isPracticeState);
  // Until the first move, the puzzle on screen is dealt from a seed of this visit.
  const [fresh] = useState(() => ({ seed: newSeed(), variant: "", moves: [], count: (stored?.count ?? 0) + 1 }));
  const allowance = usePracticeAllowance(game);
  const pro = useProT();

  const variants = definition.variants ?? [];
  const state = stored ?? fresh;
  const variant = variants.some((entry) => entry.id === state.variant) ? state.variant : "";
  const ids = board.data.deal(state.seed, 1, variant || undefined)[0];
  const dealt = ids ? board.data.puzzleOf(ids) : undefined;
  // A puzzle that has left the roster since it was dealt: deal another.
  const puzzle = dealt ?? board.data.puzzleOf(board.data.deal(`${state.seed}:again`, 1, variant || undefined)[0] ?? []);
  const over = puzzle !== undefined && state.moves.length > 0 && board.data.score(puzzle, state.moves).over;

  function moves(next: unknown[]) {
    if (!next.length) return;
    if (!state.moves.length) allowance.take(); // the puzzle starts: it counts
    setStored({ ...state, variant, moves: [...state.moves, ...next] });
  }

  function deal(nextVariant = variant) {
    setStored({ seed: newSeed(), variant: nextVariant, moves: [], count: state.count + 1 });
    window.scrollTo({ top: 0 });
  }

  if (puzzle === undefined) return <GameSkeleton />;
  // The day's allowance is used: the result of the last one stays, the next is not dealt.
  if (allowance.locked && !state.moves.length) return <PracticeLimit limit={allowance.limit ?? 0} />;
  const { Board } = board;
  const label = shell("practiceNo", { n: state.count });

  return (
    <GameFrameProvider
      value={{ slug: definition.slug, title: definition.title, family: definition.family, daily: false, practice: true }}
    >
      {variants.length > 1 && (
        <nav className="practice-variants" aria-label={shell("practiceVariants")}>
          {variants.map((entry, i) => {
            const id = i === 0 ? "" : entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                className="chip"
                aria-pressed={variant === id}
                onClick={() => variant !== id && deal(id)}
              >
                {entry.name[locale]}
              </button>
            );
          })}
        </nav>
      )}
      <Board
        key={`${state.seed}:${variant}`}
        puzzle={puzzle}
        moves={state.moves}
        onMove={(next) => moves([next])}
        onMoves={moves}
        year={new Date().getFullYear()}
        label={label}
      >
        <div className="summary-actions practice-actions">
          {allowance.remaining !== null && <Chip tone="pro">{pro("practiceLeft", { n: allowance.remaining })}</Chip>}
          <Button variant="play" onClick={() => deal()} icon={<Icon name="shuffle" size={17} />} autoFocus={over}>
            {shell("practiceNext")}
          </Button>
          <ButtonLink href={`/play/${game}`} variant="secondary">
            {shell("practiceDaily")}
          </ButtonLink>
        </div>
      </Board>
      <GamePanels
        game={definition.slug}
        help={[...words.help, shell("practiceHelp")]}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={0}
        tiles={[]}
      />
    </GameFrameProvider>
  );
}

/** In place of a practice puzzle once the day's allowance is used: the way to Pro, and back to the dailies. */
function PracticeLimit({ limit }: { limit: number }) {
  const t = useProT();
  const { plan } = useEntitlements();
  return (
    <main className="shell-page pro-gate-page">
      <ProTeaser
        feature="practice.unlimited"
        title={t("practiceTitle")}
        body={
          plan === "guest"
            ? t("practiceBodyGuest", { n: limit, free: LIMITS.free.practicePerDay ?? 0 })
            : t("practiceBody", { n: limit })
        }
        actions={
          <ButtonLink href="/daily" variant="secondary" icon={<Icon name="calendar" size={17} />}>
            {t("backToDailies")}
          </ButtonLink>
        }
      />
    </main>
  );
}
