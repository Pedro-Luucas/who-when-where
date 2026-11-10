"use client";

import { Segmented, Stepper } from "@/components/controls";
import { GAME_SLUGS, GAME_TITLES } from "@/games/slugs";
import { useSocialT } from "@/social/messages";
import {
  DIFFICULTIES,
  MAX_ROUNDS,
  ORDERS,
  PACES,
  TIME_LIMITS,
  TRIES,
  difficultyOf,
  stageCount,
  type Difficulty,
  type ExpeditionSettings,
  type TriesKey,
} from "./settings";

type Props = {
  value: ExpeditionSettings;
  onChange: (value: ExpeditionSettings) => void;
  /** Shows the settings without letting them be changed (a party member who is not the host). */
  disabled?: boolean;
  /** Adds the choice of pace, which only matters to a party. */
  party?: boolean;
};

const TRIES_KEYS: TriesKey[] = ["digs", "guesses", "attempts", "spare"];
const DIFFICULTY_NAMES = Object.keys(DIFFICULTIES) as Difficulty[];

/** "1:30" for 90 seconds. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Everything about an expedition a player can turn: which games, how many, in what order, how hard. */
export function SettingsForm({ value, onChange, disabled, party }: Props) {
  const { t } = useSocialT();
  const total = stageCount(value);
  const difficulty = difficultyOf(value);

  return (
    <div className="setup" aria-disabled={disabled || undefined}>
      <fieldset className="setup-group" disabled={disabled}>
        <legend>
          {t("setupGames")} <small>{t("puzzleCount", { n: total })}</small>
        </legend>
        <ul className="setup-games">
          {GAME_SLUGS.map((game) => (
            <li key={game} data-off={value.rounds[game] === 0 ? "" : undefined}>
              <span>
                <b>{GAME_TITLES[game]}</b>
                <small>{t(`about_${game}`)}</small>
              </span>
              <Stepper
                label={GAME_TITLES[game]}
                value={value.rounds[game]}
                min={
                  // The last game left keeps at least one puzzle.
                  total - value.rounds[game] === 0 ? 1 : 0
                }
                max={MAX_ROUNDS}
                disabled={disabled}
                onChange={(rounds) => onChange({ ...value, rounds: { ...value.rounds, [game]: rounds } })}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="setup-group" disabled={disabled}>
        <legend>{t("setupOrder")}</legend>
        <Segmented
          label={t("setupOrder")}
          options={ORDERS.map((order) => ({ value: order, label: t(`order_${order}`) }))}
          value={value.order}
          disabled={disabled}
          onChange={(order) => onChange({ ...value, order })}
        />
        <p className="hint">{t(`orderHint_${value.order}`)}</p>
      </fieldset>

      <fieldset className="setup-group" disabled={disabled}>
        <legend>{t("setupClock")}</legend>
        <Segmented
          label={t("setupClock")}
          options={TIME_LIMITS.map((seconds) => ({
            value: seconds,
            label: seconds === 0 ? t("clockOff") : clock(seconds),
          }))}
          value={value.timeLimit}
          disabled={disabled}
          onChange={(timeLimit) => onChange({ ...value, timeLimit })}
        />
        <p className="hint">{t(value.timeLimit ? "clockHint" : "clockOffHint")}</p>
      </fieldset>

      <fieldset className="setup-group" disabled={disabled}>
        <legend>{t("setupDifficulty")}</legend>
        <Segmented
          label={t("setupDifficulty")}
          options={[
            ...DIFFICULTY_NAMES.map((name) => ({ value: name as Difficulty | "custom", label: t(`difficulty_${name}`) })),
            ...(difficulty === "custom" ? [{ value: "custom" as const, label: t("difficulty_custom") }] : []),
          ]}
          value={difficulty}
          disabled={disabled}
          onChange={(name) => name !== "custom" && onChange({ ...value, ...DIFFICULTIES[name] })}
        />
        <ul className="setup-tries">
          {TRIES_KEYS.map((key) => (
            <li key={key}>
              <span>{t(`tries_${key}`)}</span>
              <Stepper
                label={t(`tries_${key}`)}
                value={value[key]}
                min={TRIES[key].min}
                max={TRIES[key].max}
                disabled={disabled}
                onChange={(tries) => onChange({ ...value, [key]: tries })}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {party && (
        <fieldset className="setup-group" disabled={disabled}>
          <legend>{t("setupPace")}</legend>
          <Segmented
            label={t("setupPace")}
            options={PACES.map((pace) => ({ value: pace, label: t(`pace_${pace}`) }))}
            value={value.pace}
            disabled={disabled}
            onChange={(pace) => onChange({ ...value, pace })}
          />
          <p className="hint">{t(`paceHint_${value.pace}`)}</p>
        </fieldset>
      )}
    </div>
  );
}

/** The settings in one line, for lists: "8 puzzles · 2:00 each · hard". */
export function useSettingsLine(): (settings: ExpeditionSettings) => string {
  const { t } = useSocialT();
  return (settings) => {
    const difficulty = difficultyOf(settings);
    return [
      t("puzzleCount", { n: stageCount(settings) }),
      settings.timeLimit ? t("clockEach", { time: clock(settings.timeLimit) }) : t("noClock"),
      t(`difficulty_${difficulty}`).toLowerCase(),
    ].join(" · ");
  };
}
