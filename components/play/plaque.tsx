"use client";

import { useEffect, useRef } from "react";
import { familyStyle, useGameFrame } from "@/games/platform/frame";
import { cue, cueOfTone } from "@/lib/fx";
import { useFocusWhenLost } from "@/lib/focus";

type Props = {
  /** What to do, in a few words: "Find this person's birthplace". */
  eyebrow: string;
  /** The prompt. Words wrapped in *asterisks* are lit in the accent colour. */
  text: string;
  /** A line under the prompt: how the last try went ("That's Mongolia · 2 tries left"). */
  status?: React.ReactNode;
  /** Colours the status line: a heat (data-tone="heat-N"), "on", "near", "off"… */
  tone?: string;
  /** The prompt is the page's title when the game has no other (Wayfarer, First to Last, Overland). */
  as?: "h1" | "h2";
};

/**
 * The prompt plaque over the board: a small eyebrow, the prompt in large
 * type, and the verdict of the last try, with the game's family colour along
 * its top edge. It takes the focus when a new round puts it on screen.
 *
 * A new verdict the player caused (a tap, a key) also sounds: a bright blip
 * for a hit, a softer one for a near miss, a low one for a miss (lib/fx.ts,
 * when sound is on), and the line pops — or shakes, for a miss.
 */
export function Plaque({ eyebrow, text, status, tone, as: Heading = "h2" }: Props) {
  const frame = useGameFrame();
  const heading = useFocusWhenLost<HTMLHeadingElement>();
  const line = useRef<HTMLParagraphElement>(null);
  const said = useRef<string | null>(null);

  useEffect(() => {
    const words = line.current?.textContent ?? "";
    const before = said.current;
    said.current = words;
    // The first look (a saved round reopened) and a cleared line are not news.
    if (before === null || !words || words === before) return;
    if (typeof navigator !== "undefined" && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const name = cueOfTone(tone);
    if (name) cue(name);
    // Replay the pop (or the shake) on a new verdict with the same tone.
    const el = line.current;
    if (el) {
      el.removeAttribute("data-fresh");
      void el.offsetWidth;
      el.setAttribute("data-fresh", name ?? "");
    }
  });

  return (
    <div className="plaque" style={familyStyle(frame?.family)}>
      <p className="plaque-eyebrow">{eyebrow}</p>
      <Heading className="plaque-prompt question" ref={heading} tabIndex={-1}>
        {text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
      </Heading>
      {status && (
        <p className="plaque-status" data-tone={tone} role="status" ref={line}>
          {status}
        </p>
      )}
    </div>
  );
}
