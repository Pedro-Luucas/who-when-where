import { seededShuffle } from "@/lib/daily";
import { formatYear } from "@/lib/i18n";
import { EVENTS, eventById, type HistoryEvent } from "../first-to-last/events";
import { defineSetData } from "../engines/kit";
import { PASS, pickDetail } from "../engines/rules";
import { MAX_POINTS, type Score } from "@/lib/points";
import { definition } from "./definition";

// Timeline without its interface. A starter card lies on the timeline with its
// year showing; twenty more come up one at a time, and each must be slotted
// into the right gap of the timeline as it stands. Right or wrong, the card
// then goes into its true place, so the timeline is always in order and the
// gaps get tighter as it fills. The run ends at the last card or the last
// mistake allowed.
//
// A move is the gap chosen, as a string: "0" is before the earliest card,
// "n" after the last of the n on the timeline. PASS gives up the rest.

/** Cards to place, after the starter. */
export const DECK = 20;
/** Mistakes allowed when the host sets none. */
export const TRIES = 3;

/** The starter (already on the timeline) and the deck, in the order it comes up. */
export type Puzzle = { starter: HistoryEvent; deck: HistoryEvent[] };

/** Two years in a puzzle are at least this far apart: the gap must be a fair question… */
const MIN_APART = 3;
/** …and an approximate date at least this far from any other. */
const CIRCA_APART = 15;
/** The roster is cut into this many eras, earliest to latest, and each gives the same share of cards. */
const ERAS = 7;

const CHRONOLOGICAL = [...EVENTS].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

const fits = (event: HistoryEvent, chosen: readonly HistoryEvent[]) =>
  chosen.every((other) => {
    const apart = Math.abs(other.year - event.year);
    return apart >= (event.circa || other.circa ? CIRCA_APART : MIN_APART);
  });

function dealTimeline(seed: string): Puzzle {
  const size = DECK + 1;
  // Each era shuffled; cards are drawn from the eras in turn, so every puzzle
  // runs from antiquity to the last century whatever the roster leans to.
  const eras = Array.from({ length: ERAS }, (_, era) =>
    seededShuffle(
      CHRONOLOGICAL.filter((_, i) => Math.floor((i * ERAS) / CHRONOLOGICAL.length) === era),
      `${seed}:era:${era}`,
    ),
  );
  const chosen: HistoryEvent[] = [];
  for (let turn = 0; chosen.length < size && turn < CHRONOLOGICAL.length; turn++) {
    for (const era of seededShuffle(eras, `${seed}:turn:${turn}`)) {
      if (chosen.length >= size) break;
      const at = era.findIndex((event) => fits(event, chosen));
      if (at >= 0) chosen.push(...era.splice(at, 1));
    }
  }
  const order = seededShuffle(chosen, `${seed}:order`);
  // The starter's year is shown from the start: an exact one reads best.
  const first = Math.max(
    0,
    order.findIndex((event) => !event.circa),
  );
  const [starter] = order.splice(first, 1);
  return { starter, deck: order };
}

function fromIds(ids: string[]): Puzzle | undefined {
  const events = ids.map(eventById);
  if (events.length < 2 || events.some((event) => event === undefined)) return undefined;
  const [starter, ...deck] = events as HistoryEvent[];
  return { starter, deck };
}

// ── The walk: how a run stands after its moves ─────────────────────────────

export type Verdict = "hit" | "miss" | "skip";

export type Step = {
  event: HistoryEvent;
  /** The gap chosen (null for a PASS, or a move that names no gap). */
  gap: number | null;
  /** The right gap, on the timeline as it stood. */
  truth: number;
  /** The cards either side of the chosen gap, as the timeline stood. */
  between: [HistoryEvent | null, HistoryEvent | null] | null;
  verdict: Verdict;
};

export type Walk = {
  /** The timeline after the steps taken, earliest first. */
  line: HistoryEvent[];
  steps: Step[];
  correct: number;
  misses: number;
  bestRun: number;
  over: boolean;
  /** The card to place next, while the run lasts. */
  next: HistoryEvent | null;
};

const gapOf = (move: string, size: number): number | null => {
  if (!/^\d+$/.test(move)) return null;
  const gap = Number(move);
  return gap <= size ? gap : null;
};

/** The gap `event` belongs in, on a timeline in order. */
export const trueGap = (line: readonly HistoryEvent[], event: HistoryEvent): number => {
  const at = line.findIndex((card) => card.year > event.year);
  return at < 0 ? line.length : at;
};

/** Plays `moves` through the puzzle. Moves past the end of the run are ignored. */
export function walk(puzzle: Puzzle, moves: readonly string[], tries = TRIES): Walk {
  const line = [puzzle.starter];
  const steps: Step[] = [];
  let correct = 0;
  let misses = 0;
  let run = 0;
  let bestRun = 0;
  let over = puzzle.deck.length === 0;
  for (const move of moves) {
    if (over) break;
    const event = puzzle.deck[steps.length];
    const truth = trueGap(line, event);
    const gap = move === PASS ? null : gapOf(move, line.length);
    const verdict: Verdict = move === PASS ? "skip" : gap === truth ? "hit" : "miss";
    steps.push({
      event,
      gap,
      truth,
      between: gap === null ? null : [line[gap - 1] ?? null, line[gap] ?? null],
      verdict,
    });
    line.splice(truth, 0, event);
    if (verdict === "hit") {
      correct++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else {
      run = 0;
      if (verdict === "miss") misses++;
    }
    over = verdict === "skip" || misses >= tries || steps.length >= puzzle.deck.length;
  }
  return { line, steps, correct, misses, bestRun, over, next: over ? null : puzzle.deck[steps.length] };
}

/** One card placed right is worth 1/20 of the 1,000. */
export function scoreTimeline(puzzle: Puzzle, moves: readonly string[], tries = TRIES): Score {
  const { correct, over } = walk(puzzle, moves, tries);
  const total = puzzle.deck.length;
  return {
    over,
    points: total ? Math.round((MAX_POINTS * correct) / total) : 0,
    detail: pickDetail(correct, total),
  };
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealTimeline(`${definition.slug}:day:${day}`),
  deal: (seed) => dealTimeline(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => [puzzle.starter, ...puzzle.deck].map((event) => event.id),
  score: scoreTimeline,
  answer(puzzle, locale) {
    const years = [puzzle.starter, ...puzzle.deck].map((event) => event.year);
    return `${formatYear(Math.min(...years), locale)} → ${formatYear(Math.max(...years), locale)}`;
  },
});
