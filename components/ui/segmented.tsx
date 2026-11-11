"use client";

import { cn } from "./cn";

// One look for every set of choices on the site (settings, expedition setup,
// leaderboard filters). The styles are .segmented and .stepper in app/social.css.

type SegmentedProps<T extends string | number> = {
  /** Names the group for assistive technology. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/** A row of choices where exactly one is pressed. */
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled, className }: SegmentedProps<T>) {
  return (
    <div className={cn("segmented", className)} role="group" aria-label={label}>
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
