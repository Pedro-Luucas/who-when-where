import type { FamilyId } from "@/games/families";

type Mark = FamilyId | "social";

// One line-drawn mark per family, drawn in currentColor on a 24-unit grid.
const PATHS: Record<Mark, React.ReactNode> = {
  // A head and shoulders.
  who: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20c.9-3.9 3.7-6 7.2-6s6.3 2.1 7.2 6" />
    </>
  ),
  // An hourglass.
  when: (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5c0 4.4 4.5 5.6 4.5 8.5s-4.5 4.1-4.5 8.5M16.5 3.5c0 4.4-4.5 5.6-4.5 8.5s4.5 4.1 4.5 8.5" />
    </>
  ),
  // A map pin.
  where: (
    <>
      <path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  // A country's outline.
  shapes: <path d="M5 8.5l3.5-4 4 1.5 3-1.5 3.5 4-1 4 2 3.5-4.5 4-3-1.5-3.5 1.5-3-3 1-4z" />,
  // A flag on a pole.
  flags: (
    <>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4.5c3-1.6 5.5 1.6 8.5 0s4.5-.5 4.5-.5v8.5s-1.5-1.1-4.5.5-5.5-1.6-8.5 0" />
    </>
  ),
  // Two letters.
  words: (
    <>
      <path d="M3.5 18l4-11.5 4 11.5M5 14h5" />
      <path d="M14 10.5c.7-1 1.8-1.5 3-1.5 2 0 3.2 1.2 3.2 3.2V18M20.2 13.6c-3.8 0-6 .9-6 2.6 0 1.2.9 1.9 2.3 1.9 2 0 3.7-1.5 3.7-3.6" />
    </>
  ),
  // Rising bars.
  numbers: <path d="M4 20.5h16M6.5 20.5v-6M11 20.5v-10M15.5 20.5v-7M20 20.5v-14" />,
  // Two people.
  social: (
    <>
      <circle cx="8.5" cy="9" r="3" />
      <circle cx="16.5" cy="8" r="2.5" />
      <path d="M3 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14.5 13.2c.6-.2 1.3-.3 2-.3 2.4 0 4.2 1.5 4.6 4.6" />
    </>
  ),
};

/** The line-drawn mark of a game family (or of the social games). */
export function FamilyIcon({ family, className }: { family: Mark; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[family]}
    </svg>
  );
}
