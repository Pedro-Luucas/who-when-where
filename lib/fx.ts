"use client";

import { getPrefs } from "./prefs";

// What the site does besides showing things: short sounds, a buzz on phones
// and paper confetti. Every effect checks the player's preferences
// (lib/prefs.ts) first, and none of them is needed to play.

/** move: a guess went in · win, great: a puzzle went well · lose: it did not · unlock: an achievement. */
export type Cue = "move" | "win" | "great" | "lose" | "unlock";

// ── Sound ───────────────────────────────────────────────────────────────────
// A few plucked notes, made on the spot: no audio files to fetch.

type Note = { hz: number; at: number; length: number; gain?: number };

const C5 = 523.25;
const SCORES: Record<Cue, Note[]> = {
  move: [{ hz: 587.33, at: 0, length: 0.07, gain: 0.5 }],
  win: [
    { hz: C5, at: 0, length: 0.16 },
    { hz: 659.25, at: 0.09, length: 0.16 },
    { hz: 783.99, at: 0.18, length: 0.3 },
  ],
  great: [
    { hz: C5, at: 0, length: 0.14 },
    { hz: 659.25, at: 0.08, length: 0.14 },
    { hz: 783.99, at: 0.16, length: 0.14 },
    { hz: 1046.5, at: 0.24, length: 0.45 },
    { hz: 1318.5, at: 0.34, length: 0.5, gain: 0.5 },
  ],
  lose: [
    { hz: 329.63, at: 0, length: 0.22, gain: 0.7 },
    { hz: 261.63, at: 0.16, length: 0.4, gain: 0.7 },
  ],
  unlock: [
    { hz: 783.99, at: 0, length: 0.12 },
    { hz: 1046.5, at: 0.1, length: 0.12 },
    { hz: 1174.66, at: 0.2, length: 0.12 },
    { hz: 1567.98, at: 0.3, length: 0.5 },
  ],
};

const VOLUME = 0.16;
let audio: AudioContext | null = null;

function play(cue: Cue): void {
  if (!getPrefs().sound) return;
  try {
    audio ??= new AudioContext();
    // A context made before the player touched the page starts out suspended.
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime + 0.02;
    for (const note of SCORES[cue]) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const peak = VOLUME * (note.gain ?? 1);
      oscillator.type = "triangle";
      oscillator.frequency.value = note.hz;
      envelope.gain.setValueAtTime(0, start + note.at);
      envelope.gain.linearRampToValueAtTime(peak, start + note.at + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);
      oscillator.connect(envelope).connect(audio.destination);
      oscillator.start(start + note.at);
      oscillator.stop(start + note.at + note.length + 0.03);
    }
  } catch {
    // No sound on this device: the game goes on without it.
  }
}

// ── Vibration ───────────────────────────────────────────────────────────────

const BUZZES: Record<Cue, number | number[]> = {
  move: 12,
  win: [18, 50, 30],
  great: [18, 40, 18, 40, 60],
  lose: 70,
  unlock: [14, 40, 14, 40, 14],
};

function buzz(cue: Cue): void {
  if (!getPrefs().haptics) return;
  try {
    navigator.vibrate?.(BUZZES[cue]);
  } catch {
    // Not allowed here (an embedded page, a desktop browser): no matter.
  }
}

// ── Confetti ────────────────────────────────────────────────────────────────
// Scraps of paper in the atlas's own colours, shot up from the two lower
// corners. Drawn on a canvas laid over the page and gone in three seconds.

type Scrap = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  turn: number;
  spin: number;
  sway: number;
  colour: string;
};

const SCRAPS = { 1: 46, 2: 90, 3: 170 } as const;
const LIFETIME_MS = 3200;
let flying = false;

/** Throws confetti: 1 a handful, 3 the lot. */
export function confetti(amount: 1 | 2 | 3): void {
  if (!getPrefs().effects || flying) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  flying = true;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  context.scale(ratio, ratio);

  const tokens = getComputedStyle(document.documentElement);
  const colours = ["--accent", "--answer", "--pro", "--guess", "--heat-5"]
    .map((name) => tokens.getPropertyValue(name).trim())
    .filter(Boolean);

  // Phones get a narrower, gentler burst: the corners are closer together.
  const power = Math.min(Math.max(Math.sqrt(height) * 0.9, 16), 30);
  const scraps: Scrap[] = Array.from({ length: SCRAPS[amount] }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -1 : 1) * (0.25 + Math.random() * 0.75);
    const speed = power * (0.55 + Math.random() * 0.6);
    return {
      x: fromLeft ? -10 : width + 10,
      y: height * (0.72 + Math.random() * 0.2),
      vx: -Math.sin(angle) * speed * (width < 640 ? 0.55 : 1),
      vy: -Math.cos(angle) * speed,
      width: 5 + Math.random() * 6,
      height: 8 + Math.random() * 9,
      turn: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4,
      sway: Math.random() * Math.PI * 2,
      colour: colours[i % colours.length] ?? "#4fabf6",
    };
  });

  const started = performance.now();
  let previous = started;

  function frame(now: number) {
    const age = now - started;
    const step = Math.min((now - previous) / 16.7, 3);
    previous = now;
    context?.clearRect(0, 0, width, height);
    if (age > LIFETIME_MS || !context) {
      canvas.remove();
      flying = false;
      return;
    }
    // Fade the last stretch rather than popping out.
    context.globalAlpha = Math.min(1, (LIFETIME_MS - age) / 700);
    for (const scrap of scraps) {
      scrap.vy += 0.42 * step;
      scrap.vx *= 0.985 ** step;
      scrap.vy *= 0.985 ** step;
      scrap.sway += 0.09 * step;
      scrap.x += (scrap.vx + Math.sin(scrap.sway) * 0.9) * step;
      scrap.y += scrap.vy * step;
      scrap.turn += scrap.spin * step;
      context.save();
      context.translate(scrap.x, scrap.y);
      context.rotate(scrap.turn);
      // A scrap seen edge-on is thin: this is what makes paper flutter.
      context.scale(1, Math.cos(scrap.sway * 1.7));
      context.fillStyle = scrap.colour;
      context.fillRect(-scrap.width / 2, -scrap.height / 2, scrap.width, scrap.height);
      context.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── Cues ────────────────────────────────────────────────────────────────────

/** A sound and a buzz for something that just happened. */
export function cue(name: Cue): void {
  play(name);
  buzz(name);
}

/**
 * The end of a puzzle, by what it earned (out of 1,000): a fanfare and
 * confetti for a good one, a sigh for one that got away.
 */
export function cuePuzzle(points: number, lost: boolean): void {
  if (lost || points < 400) return cue("lose");
  if (points >= 900) {
    cue("great");
    confetti(2);
  } else {
    cue("win");
    if (points >= 650) confetti(1);
  }
}
