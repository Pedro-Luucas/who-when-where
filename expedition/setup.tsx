"use client";

import { useEntitlements } from "@/account/entitlements";
import { Segmented, Stepper } from "@/components/controls";
import { useProT } from "@/components/pro/messages";
import { ProChip } from "@/components/pro/pro-chip";
import { openProSheet } from "@/components/pro/pro-sheet";
import { GAMES } from "@/games/registry";
import { useSocialT } from "@/social/messages";
import {
  DIFFICULTY_NAMES,
  MAX_ROUNDS,
  ORDERS,
  PACES,
  TIME_LIMITS,
  TRIES_GAMES,
  difficultyOf,
  stageCount,
  withDifficulty,
  type Difficulty,
  type ExpeditionSettings,
} from "./settings";

type Props = {
  value: ExpeditionSettings;
  onChange: (value: ExpeditionSettings) => void;
  /** Shows the settings without letting them be changed (a party member who is not the host). */
  disabled?: boolean;
  /** Adds the choice of pace, which only matters to a party. */
  party?: boolean;
};

/** "1:30" for 90 seconds. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Everything about an expedition a player can turn: which games, how many, in what order, how hard. */
export function SettingsForm({ value, onChange, disabled, party }: Props) {
  const { locale, t } = useSocialT();
  const total = stageCount(value);
  const difficulty = difficultyOf(value);
  const pro = useProT();
  const { has } = useEntitlements();
  // With the plans switch on: Pro games and the tries per game are Pro (shared/plans.ts).
  // A run that already has them (a challenge link) keeps them; they just cannot be added.
  const proGames = has("games.pro") || (party === true && has("party.unlockGames"));
  const allSettings = has("expedition.allSettings");

  return (
    <div className="setup" aria-disabled={disabled || undefined}>
      <fieldset className="setup-group" disabled={disabled}>
        <legend>
          {t("setupGames")} <small>{t("puzzleCount", { n: total })}</small>
        </legend>
        <ul className="setup-games">
          {GAMES.map(({ slug: game, title, expedition, tier }) => {
            const locked = tier === "pro" && !proGames;
            return (
              <li key={game} data-off={value.rounds[game] === 0 ? "" : undefined}>
                <span>
                  <b>
                    {title} {tier === "pro" && <ProChip locked={locked} className="align-middle" />}
                  </b>
                  <small>{expedition.about[locale]}</small>
                </span>
                {locked && !disabled ? (
                  <button type="button" className="key key-pro key-sm" onClick={() => openProSheet("games.pro")}>
                    {pro("pro")}
                  </button>
                ) : (
                  <Stepper
                    label={title}
                    value={value.rounds[game]}
                    min={
                      // The last game left keeps at least one puzzle.
                      total - value.rounds[game] === 0 ? 1 : 0
                    }
                    max={locked ? value.rounds[game] : MAX_ROUNDS}
                    disabled={disabled}
                    onChange={(rounds) => onChange({ ...value, rounds: { ...value.rounds, [game]: rounds } })}
                  />
                )}
              </li>
            );
          })}
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
          onChange={(name) => name !== "custom" && onChange(withDifficulty(value, name))}
        />
        {!allSettings && !disabled && (
          <p className="hint pro-hint">
            <ProChip locked /> {pro("expeditionTries")}
          </p>
        )}
        <ul className="setup-tries">
          {TRIES_GAMES.map(({ slug, tries }) => (
            <li key={slug}>
              <span>{tries.label[locale]}</span>
              <Stepper
                label={tries.label[locale]}
                value={value.tries[slug] ?? tries.presets.standard}
                min={tries.min}
                max={tries.max}
                disabled={disabled || !allSettings}
                onChange={(count) => onChange({ ...value, tries: { ...value.tries, [slug]: count } })}
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
