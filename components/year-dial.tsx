"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initial: number;
  min: number;
  max: number;
  onChange: (year: number) => void;
  /** Accessible name for the year field and ruler. */
  label: string;
};

const PX_PER_YEAR = 9;
const VISIBLE_YEARS = 75; // rendered on each side of the needle
const STEPS = [-10, -1, 1, 10];

/**
 * Year picker: a big editable number over a draggable ruler. The ruler keeps
 * a fractional position while it is dragged or coasting and settles on a
 * whole year when it stops.
 */
export function YearDial({ initial, min, max, onChange, label }: Props) {
  const [position, setPosition] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const year = Math.round(position);
  const reported = useRef(initial);
  const drag = useRef<{ startX: number; startPosition: number; x: number; t: number; v: number } | null>(null);
  const coast = useRef<number | null>(null);

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  function moveTo(value: number) {
    const next = clamp(value);
    setPosition(next);
    const nextYear = Math.round(next);
    if (nextYear !== reported.current) {
      reported.current = nextYear;
      onChange(nextYear);
    }
    return next;
  }

  function stopCoasting() {
    if (coast.current !== null) cancelAnimationFrame(coast.current);
    coast.current = null;
  }

  useEffect(
    () => () => {
      if (coast.current !== null) cancelAnimationFrame(coast.current);
    },
    [],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    stopCoasting();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startPosition: position,
      x: event.clientX,
      t: event.timeStamp,
      v: 0,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    const dt = event.timeStamp - state.t;
    if (dt > 0) {
      // years per millisecond, lightly smoothed
      const instant = -(event.clientX - state.x) / PX_PER_YEAR / dt;
      state.v = state.v * 0.6 + instant * 0.4;
    }
    state.x = event.clientX;
    state.t = event.timeStamp;
    moveTo(state.startPosition - (event.clientX - state.startX) / PX_PER_YEAR);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    setDragging(false);

    let velocity = event.timeStamp - state.t > 80 ? 0 : state.v;
    let current = state.startPosition - (event.clientX - state.startX) / PX_PER_YEAR;
    if (Math.abs(velocity) < 0.02) {
      moveTo(Math.round(current));
      return;
    }
    let last: number | null = null;
    const step = (now: number) => {
      const dt = last === null ? 16 : Math.min(now - last, 50);
      last = now;
      current = moveTo(current + velocity * dt);
      velocity *= Math.pow(0.996, dt);
      const atEdge = current === min || current === max;
      if (Math.abs(velocity) < 0.004 || atEdge) {
        moveTo(Math.round(current));
        coast.current = null;
        return;
      }
      coast.current = requestAnimationFrame(step);
    };
    coast.current = requestAnimationFrame(step);
  }

  function nudge(amount: number) {
    stopCoasting();
    moveTo(year + amount);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const big = event.shiftKey ? 10 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: -big,
      ArrowDown: -big,
      ArrowRight: big,
      ArrowUp: big,
      PageDown: -100,
      PageUp: 100,
    };
    const amount = moves[event.key];
    if (amount === undefined) return;
    event.preventDefault();
    nudge(amount);
  }

  function commitDraft() {
    if (draft === null) return;
    const typed = parseInt(draft, 10);
    if (Number.isFinite(typed)) {
      stopCoasting();
      moveTo(typed);
    }
    setDraft(null);
  }

  const first = Math.max(min, Math.floor(position) - VISIBLE_YEARS);
  const last = Math.min(max, Math.ceil(position) + VISIBLE_YEARS);
  const ticks: number[] = [];
  for (let y = first; y <= last; y++) ticks.push(y);

  return (
    <div className="dial">
      <div className="dial-readout">
        {STEPS.slice(0, 2).map((amount) => (
          <button key={amount} type="button" className="dial-step" onClick={() => nudge(amount)}>
            {amount}
          </button>
        ))}
        <input
          className="dial-year"
          inputMode="numeric"
          aria-label={label}
          value={draft ?? String(year)}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
          onFocus={(event) => event.target.select()}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {STEPS.slice(2).map((amount) => (
          <button key={amount} type="button" className="dial-step" onClick={() => nudge(amount)}>
            +{amount}
          </button>
        ))}
      </div>

      <div
        className="dial-ruler"
        data-dragging={dragging ? "" : undefined}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={year}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="dial-ticks">
          {ticks.map((y) => {
            const rank = y % 100 === 0 ? "century" : y % 10 === 0 ? "decade" : y % 5 === 0 ? "half" : "year";
            return (
              <span
                key={y}
                className={`dial-tick dial-tick-${rank}`}
                style={{ transform: `translateX(${((y - position) * PX_PER_YEAR).toFixed(1)}px)` }}
              >
                {(rank === "century" || rank === "decade") && <span>{y}</span>}
              </span>
            );
          })}
        </div>
        <span className="dial-needle" aria-hidden="true" />
      </div>
    </div>
  );
}
