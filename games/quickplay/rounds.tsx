"use client";

import Link from "next/link";
import { countryById } from "@/lib/countries";
import { REGION_NAMES } from "@/lib/geo-data";
import { formatNumber, formatYear, numberLocale, translator, type Locale } from "@/lib/i18n";
import type { HistoryEvent } from "../first-to-last/events";
import { Flag, Lifelines, PersonCard, lifeYears } from "../engines/parts";
import type { PickOption, PickRound } from "../engines/pick";
import { PASS, tallyPicks } from "../engines/rules";
import { useGameFrame } from "../platform/frame";
import { GAME_TITLES, gameBySlug, type GameSlug } from "../registry";
import { QUESTION_MESSAGES } from "./messages";
import { KIND_GAME, capitalsOf, gapOf, valueOf, type Measure, type Moment, type Question } from "./questions";

// The questions on the Pick board, for Quickplay and Gauntlet alike: each
// one's prompt, what is on the table (a flag, two people), the options and
// the line that explains the answer. The eyebrow names the game a question
// comes from, and the plaque takes that game's family colour (quickplay.css).

type T = ReturnType<typeof translator<(typeof QUESTION_MESSAGES)["en"]>>;

export const sourceOf = (question: Question): GameSlug => KIND_GAME[question.kind];
export const familyOf = (question: Question) => gameBySlug(sourceOf(question)).family;
export const sourceTitle = (question: Question) => GAME_TITLES[sourceOf(question)];

/** "214M", "8,515,767 km²". */
function formatValue(value: number, measure: Measure, locale: Locale, t: T): string {
  if (measure === "population") {
    return new Intl.NumberFormat(numberLocale(locale), { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return t("unitKm2", { n: formatNumber(Math.round(value), locale) });
}

const eventYear = (event: HistoryEvent, locale: Locale, t: T) =>
  `${event.circa ? `${t("circa")} ` : ""}${formatYear(event.year, locale)}`;

const momentLabel = (moment: Moment, locale: Locale, t: T) =>
  moment.event
    ? moment.event.name[locale]
    : t(moment.what === "born" ? "momentBorn" : "momentDied", { name: moment.person!.name[locale] });

/** A list of names, cut short past `max`: "A, B, C and 4 more". */
function listOf(names: string[], t: T, max = 6): string {
  if (names.length <= max) return names.join(", ");
  return t("borderMore", { list: names.slice(0, max).join(", "), n: names.length - max });
}

/** What a question shows between the prompt and the options; always a marker for the styles. */
function Scene({ question, children }: { question: Question; children?: React.ReactNode }) {
  const marks = { "data-kind": question.kind, "data-type": question.type, "data-family": familyOf(question) };
  if (!children) return <span className="qp-scene" hidden {...marks} />;
  return (
    <div className="qp-scene" {...marks}>
      {children}
    </div>
  );
}

/** The parts of a round that depend on the kind of question. */
function partsOf(
  question: Question,
  locale: Locale,
  t: T,
): Pick<PickRound, "prompt" | "scene" | "options" | "reveal" | "review"> {
  const review = sourceTitle(question);
  const scene = (body?: (answered: boolean) => React.ReactNode) =>
    function QuestionScene(answered: boolean) {
      return <Scene question={question}>{body?.(answered)}</Scene>;
    };
  const ordered = <C extends { id: string }>(choices: C[], option: (choice: C) => PickOption): PickOption[] =>
    question.options.map((id) => option(choices.find((choice) => choice.id === id)!));

  switch (question.type) {
    case "flag": {
      const country = question.country;
      return {
        prompt: t("flagPrompt"),
        scene: scene((answered) => (
          <Flag id={country.id} className="qp-flag" alt={answered ? country.name[locale] : t("flagAlt")} />
        )),
        options: ordered(question.choices, (choice) => ({ id: choice.id, label: choice.name[locale] })),
        reveal: t("flagReveal", { country: country.name[locale] }),
        review,
      };
    }
    case "capital": {
      const country = question.country;
      return {
        prompt: t("capitalPrompt", { country: country.name[locale] }),
        scene: scene(() => <Flag id={country.id} className="qp-flag qp-flag-small" />),
        options: ordered(question.choices, (city) => ({
          id: city.id,
          label: city.name[locale],
          fact: countryById(city.country)?.name[locale],
        })),
        reveal: t("capitalReveal", { city: question.choices[0].name[locale], country: country.name[locale] }),
        review,
      };
    }
    case "capitalOf": {
      const city = question.city;
      const country = question.choices[0];
      return {
        prompt: t("capitalOfPrompt", { city: city.name[locale] }),
        scene: scene(),
        options: ordered(question.choices, (choice) => ({
          id: choice.id,
          label: choice.name[locale],
          media: <Flag id={choice.id} />,
          fact: capitalsOf(choice.id)
            .map((capital) => capital.name[locale])
            .join(" · "),
        })),
        reveal: t("capitalReveal", { city: city.name[locale], country: country.name[locale] }),
        review,
      };
    }
    case "earlier": {
      const [first, second] = question.choices;
      return {
        prompt: t("earlierPrompt"),
        scene: scene(),
        options: ordered(question.choices, (event) => ({
          id: event.id,
          label: event.name[locale],
          sub: event.place[locale],
          fact: eventYear(event, locale, t),
        })),
        reveal: t("earlierReveal", {
          a: first.name[locale],
          ya: eventYear(first, locale, t),
          b: second.name[locale],
          yb: eventYear(second, locale, t),
        }),
        review,
      };
    }
    case "bornIn": {
      const person = question.person;
      const place = person.born.place.name[locale];
      return {
        prompt: t("bornInPrompt", { place }),
        scene: scene(),
        options: ordered(question.choices, (choice) => ({
          id: choice.id,
          label: choice.name[locale],
          sub: choice.field[locale],
          fact: `${choice.born.place.name[locale]} · ${formatYear(choice.born.year, locale)}`,
        })),
        reveal: t("bornInReveal", { name: person.name[locale], place, year: formatYear(person.born.year, locale) }),
        review,
      };
    }
    case "met": {
      const [a, b] = question.pair;
      const gap = gapOf(a, b);
      return {
        prompt: t("metPrompt", { a: a.name[locale], b: b.name[locale] }),
        scene: scene((answered) =>
          answered ? (
            <Lifelines
              label={t("lifetimes")}
              locale={locale}
              overlap
              lives={[a, b].map((person) => ({
                id: person.id,
                name: person.name[locale],
                born: person.born.year,
                died: person.died.year,
              }))}
            />
          ) : (
            // Their field only: a nationality would hint at where, and so at when.
            <div className="people-pair">
              <PersonCard name={a.name[locale]} note={a.field[locale]} />
              <PersonCard name={b.name[locale]} note={b.field[locale]} />
            </div>
          ),
        ),
        options: [
          { id: "yes", label: t("yes") },
          { id: "no", label: t("no") },
        ],
        reveal: gap < 0 ? (gap === -1 ? t("metRevealOne") : t("metReveal", { n: -gap })) : t("missedReveal", { n: gap }),
        review,
      };
    }
    case "bornFirst": {
      const [first, second] = question.choices;
      return {
        prompt: t("bornFirstPrompt"),
        scene: scene((answered) =>
          answered ? (
            <Lifelines
              label={t("lifetimes")}
              locale={locale}
              lives={question.choices.map((person) => ({
                id: person.id,
                name: person.name[locale],
                born: person.born.year,
                died: person.died.year,
              }))}
            />
          ) : null,
        ),
        options: ordered(question.choices, (person) => ({
          id: person.id,
          label: person.name[locale],
          sub: person.field[locale],
          fact: lifeYears(person.born.year, person.died.year, locale),
        })),
        reveal: t("bornFirstReveal", {
          a: first.name[locale],
          ya: formatYear(first.born.year, locale),
          b: second.name[locale],
          yb: formatYear(second.born.year, locale),
        }),
        review,
      };
    }
    case "bigger": {
      const [more, less] = question.choices;
      const shown = (country: typeof more) => formatValue(valueOf(country, question.measure) ?? 0, question.measure, locale, t);
      return {
        prompt: t(`biggerPrompt_${question.measure}`),
        scene: scene(),
        options: ordered(question.choices, (country) => ({
          id: country.id,
          label: country.name[locale],
          media: <Flag id={country.id} />,
          fact: shown(country),
        })),
        reveal: t("biggerReveal", { a: more.name[locale], va: shown(more), b: less.name[locale], vb: shown(less) }),
        review,
      };
    }
    case "border": {
      const country = question.country;
      const neighbours = country.borders.flatMap((id) => countryById(id)?.name[locale] ?? []);
      return {
        prompt: t("borderPrompt", { country: country.name[locale] }),
        scene: scene(() => <Flag id={country.id} className="qp-flag qp-flag-small" />),
        options: ordered(question.choices, (choice) => ({
          id: choice.id,
          label: choice.name[locale],
          media: <Flag id={choice.id} />,
          fact: choice.id === question.answer ? t("neighbour") : t("notNeighbour"),
        })),
        reveal: t("borderReveal", { country: country.name[locale], list: listOf(neighbours, t) }),
        review,
      };
    }
    case "continent": {
      const country = question.country;
      return {
        prompt: t("continentPrompt", { country: country.name[locale] }),
        scene: scene(() => <Flag id={country.id} className="qp-flag qp-flag-small" />),
        options: question.options.map((id) => ({ id, label: REGION_NAMES[id as keyof typeof REGION_NAMES][locale] })),
        reveal: t("continentReveal", {
          country: country.name[locale],
          continent: REGION_NAMES[question.choices[0]][locale],
        }),
        review,
      };
    }
    case "sameYear": {
      const odd = question.odd;
      const year = question.choices[1].year;
      return {
        prompt: t("sameYearPrompt"),
        scene: scene(),
        options: ordered(question.choices, (moment) => ({
          id: moment.id,
          label: momentLabel(moment, locale, t),
          fact: formatYear(moment.year, locale),
        })),
        reveal: t("sameYearReveal", { year: formatYear(year, locale), odd: formatYear(odd.year, locale) }),
        review,
      };
    }
  }
}

/** The questions as Pick rounds; `eyebrow` names each one ("From Flag Peek", "Level 3 · From Flag Peek"). */
export function questionRounds(
  questions: readonly Question[],
  locale: Locale,
  eyebrow: (question: Question, index: number, t: T) => string,
): PickRound[] {
  const t = translator(QUESTION_MESSAGES, locale);
  return questions.map((question, i) => ({
    key: question.id,
    eyebrow: eyebrow(question, i, t),
    answer: question.answer,
    ...partsOf(question, locale, t),
  }));
}

/** The eyebrow Quickplay shows: the game the question comes from. */
export const fromLine = (question: Question, t: T) => t("from", { game: sourceTitle(question) });

/** Under the result: how each game's questions went, right out of asked. */
export function ByGame({ questions, moves, lives, locale }: { questions: readonly Question[]; moves: string[]; lives?: number; locale: Locale }) {
  const frame = useGameFrame();
  const t = translator(QUESTION_MESSAGES, locale);
  const tally = tallyPicks(
    questions.map((question) => question.answer),
    moves,
    lives,
  );
  const games = new Map<GameSlug, { asked: number; right: number; question: Question }>();
  tally.rounds.forEach((right, i) => {
    if (moves[i] === PASS) return;
    const question = questions[i];
    const entry = games.get(sourceOf(question)) ?? { asked: 0, right: 0, question };
    entry.asked++;
    if (right) entry.right++;
    games.set(sourceOf(question), entry);
  });
  if (!games.size) return null;
  // Links lead out of the game: only on its own pages, never in the middle of an expedition or a party.
  const linked = !!frame && (frame.daily || frame.practice);
  const rows = [...games.entries()].sort((a, b) => b[1].asked - a[1].asked || b[1].right - a[1].right);

  return (
    <section className="qp-by-game" aria-labelledby="qp-by-game-title">
      <h3 id="qp-by-game-title" className="eyebrow">
        {t("byGame")}
      </h3>
      <ul>
        {rows.map(([slug, { asked, right, question }]) => {
          const body = (
            <>
              <span className="qp-by-game-name">{GAME_TITLES[slug]}</span>
              <span className="qp-by-game-score" data-tone={right === asked ? "hit" : right === 0 ? "miss" : undefined}>
                {right}/{asked}
              </span>
            </>
          );
          return (
            <li key={slug} data-family={familyOf(question)}>
              {linked ? (
                <Link href={`/play/${slug}`} title={t("byGameNote")}>
                  {body}
                </Link>
              ) : (
                <span>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
