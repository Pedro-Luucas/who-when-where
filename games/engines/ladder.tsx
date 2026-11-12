"use client";

import { Hud, type HudStat, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ResultStat, type ReviewRow, type Verdict } from "@/components/play/result-card";
import type { Locale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { NamePicker, type Nameable } from "./name-picker";
import { PASS, ladderOver, ladderSolved } from "./rules";

// The Name engine's ladder: something hidden (a person, a flag) and a few
// guesses to name it. Every miss shows a little more — the next clue, more of
// the picture — so the fewer it takes, the more it is worth. The game draws
// what is shown (`subject`, from the number of guesses used) and says how
// each miss reads; the guessing, the HUD and the result are the engine's.

/** How one guess reads: right, close, wrong — and a word on why. */
export type GuessReading = { verdict: Verdict; hint?: React.ReactNode };

type Props = {
  game: string;
  /** The id of the right answer, in `pool`. */
  answer: string;
  guesses: string[];
  onGuess: (id: string) => void;
  onGuesses: (ids: string[]) => void;
  max: number;
  /** Everything that can be named. */
  pool: readonly Nameable[];
  locale: Locale;
  label: string;
  /** The game in a sentence, under the subject. */
  lead: string;
  eyebrow: string;
  prompt: string;
  /** What is shown of the answer so far: the clues, the picture. */
  subject: React.ReactNode;
  /** The answer's name, once it is over. */
  answerName: string;
  read: (id: string) => GuessReading;
  points: number;
  picker: { placeholder: string; search: string; noMatch: string };
  stats?: ResultStat[];
  after?: React.ReactNode;
  children?: React.ReactNode;
};

export function LadderBoard({
  game,
  answer,
  guesses,
  onGuess,
  onGuesses,
  max,
  pool,
  locale,
  label,
  lead,
  eyebrow,
  prompt,
  subject,
  answerName,
  read,
  points,
  picker,
  stats = [],
  after,
  children,
}: Props) {
  const shell = useShellT();
  const used = guesses.length;
  const solved = ladderSolved(answer, guesses);
  const over = ladderOver(answer, guesses, max);
  const byId = new Map(pool.map((item) => [item.id, item]));
  const nameOf = (id: string) => (id === PASS ? shell("gaveUp") : (byId.get(id)?.name[locale] ?? id));
  const readingOf = (id: string): GuessReading => (id === PASS ? { verdict: "skip" } : read(id));
  const last = guesses.at(-1);
  const lastReading = last === undefined ? null : readingOf(last);

  const pips: Pip[] = Array.from({ length: max }, (_, i) => {
    const id = guesses[i];
    if (id === undefined) return i === used && !over ? "current" : "todo";
    return readingOf(id).verdict;
  });
  const hudStats: HudStat[] = [{ icon: "help", label: shell("statClues"), value: `${Math.min(used + 1, max)}/${max}` }];

  const left = max - used;
  const review: ReviewRow[] = guesses.map((id, i) => {
    const reading = readingOf(id);
    return {
      id: `${i}-${id}`,
      label: shell("tryN", { n: i + 1 }),
      verdict: reading.verdict,
      yours: nameOf(id),
      value: reading.verdict === "hit" ? undefined : reading.hint,
    };
  });

  return (
    <main className="game" data-game={game} data-engine="name" data-summary={over ? "" : undefined}>
      <Hud
        step={{ n: Math.min(used + 1, max), total: max, kind: "try" }}
        pips={pips}
        stats={hudStats}
        onGiveUp={() => onGuesses(Array.from({ length: left }, () => PASS))}
        over={over}
      />

      <aside className="dossier dossier-plain ladder-dossier">
        {subject}
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          {over && <h1 className="dossier-name">{answerName}</h1>}
          <p className={over ? "dossier-description" : "dossier-lead"}>{lead}</p>
        </div>
      </aside>

      <section className="stage">
        {over ? (
          <div className="summary">
            <ResultCard
              label={label}
              headline={
                !solved
                  ? shell("ladderLost")
                  : used === 1
                    ? shell("ladderFirst")
                    : shell("ladderSolvedIn", { n: used })
              }
              answer={answerName}
              points={points}
              stats={([
                { label: shell("statTries"), value: `${solved ? used : "X"}/${max}`, tone: solved ? "hit" : "miss" },
                { label: shell("statFound"), value: shell(solved ? "yes" : "no"), tone: solved ? "hit" : "miss" },
                ...stats,
              ] satisfies ResultStat[]).slice(0, 4)}
              review={review}
            >
              {children}
            </ResultCard>
            {after}
          </div>
        ) : (
          <>
            <Plaque
              eyebrow={eyebrow}
              text={prompt}
              tone={lastReading ? (lastReading.verdict === "near" ? "near" : "off") : undefined}
              status={
                last !== undefined && lastReading ? (
                  <>
                    <b>{nameOf(last)}</b> {lastReading.hint && <>· {lastReading.hint} </>}·{" "}
                    {left === 1 ? shell("ladderLastGuess") : shell("ladderGuessesLeft", { n: left })}
                  </>
                ) : undefined
              }
            />
            <NamePicker
              pool={pool}
              locale={locale}
              taken={new Set(guesses)}
              onSubmit={onGuess}
              labels={{ ...picker, submit: shell("guess") }}
            />
            {guesses.length > 0 && (
              <ol className="tries" reversed>
                {guesses
                  .map((id, i) => {
                    const reading = readingOf(id);
                    return (
                      <li key={`${i}-${id}`} data-state={reading.verdict === "near" ? "near" : reading.verdict === "skip" ? "skip" : "miss"}>
                        <span className="tries-n">{i + 1}</span>
                        <span className="tries-name">{nameOf(id)}</span>
                        {reading.hint && <span className="tries-hint">{reading.hint}</span>}
                      </li>
                    );
                  })
                  .reverse()}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
  );
}
