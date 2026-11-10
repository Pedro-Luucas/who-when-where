"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";

type SegmentedProps<T extends string | number> = {
  /** Names the group for assistive technology. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** A row of choices where exactly one is pressed. */
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/** A number turned up and down one step at a time. */
export function Stepper({ label, value, min, max, onChange, disabled }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} −`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={`${label} +`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * Renders its children in the browser only: for pages built from what the
 * visitor's device knows (their session, saved games, the address bar).
 */
export function BrowserOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="page" aria-busy="true">
          <div className="page-skeleton skeleton-block" />
        </main>
      }
    >
      <InBrowser>{children}</InBrowser>
    </Suspense>
  );
}

function InBrowser({ children }: { children: React.ReactNode }) {
  use(browser("This page is built from the visitor's session, saved games and address bar."));
  return children;
}
