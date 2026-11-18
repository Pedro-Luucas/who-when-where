"use client";

import { getPrefs } from "./prefs";
import { writeStore } from "./storage";

// What the site does besides showing things: short sounds, a buzz on phones
// and paper confetti. Every effect checks the player's preferences
// (lib/prefs.ts) first, and none of them is needed to play.

/**
 * move: a guess went in · hit, near, miss: how a try went (the plaque's verdict)
 * · win, great: a puzzle went well · lose: it did not · unlock: an achievement.
 */
export type Cue = "move" | "hit" | "near" | "miss" | "win" | "great" | "lose" | "unlock";

// ── Sound ───────────────────────────────────────────────────────────────────
// A few plucked notes, made on the spot: no audio files to fetch.

type Note = { hz: number; at: number; length: number; gain?: number };

const C5 = 523.25;
const SCORES: Record<Cue, Note[]> = {
  move: [{ hz: 587.33, at: 0, length: 0.07, gain: 0.5 }],
  hit: [
    { hz: 880, at: 0, length: 0.09, gain: 0.6 },
    { hz: 1318.5, at: 0.07, length: 0.18, gain: 0.55 },
  ],
  near: [
    { hz: 659.25, at: 0, length: 0.1, gain: 0.5 },
    { hz: 783.99, at: 0.08, length: 0.14, gain: 0.45 },
  ],
  // A short drop, duller than the hit's rise, so the two don't blur together.
  miss: [
    { hz: 246.94, at: 0, length: 0.1, gain: 0.5 },
    { hz: 146.83, at: 0.06, length: 0.16, gain: 0.62 },
  ],
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
    // Resume only from this call, which a tap already started. A rejection
    // (the gesture has lapsed) must not surface: the notes simply stay quiet.
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const start = audio.currentTime + 0.02;
    for (const note of SCORES[cue]) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const peak = VOLUME * (note.gain ?? 1);
      // A miss and a loss are a dull sine; a hit stays a bright triangle.
      oscillator.type = cue === "miss" || cue === "lose" ? "sine" : "triangle";
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

// Short on purpose. A hit is two taps, the second firmer (yes). A near is two
// equal taps. A miss is one dull pulse (no). A guess stays under a tenth of
// a second, so a fanfare can still follow.
const BUZZES: Record<Cue, number | number[]> = {
  move: 12,
  hit: [12, 46, 28],
  near: [14, 34, 14],
  miss: 52,
  win: [16, 42, 26],
  great: [14, 34, 14, 34, 46],
  lose: [34, 26, 48],
  unlock: [12, 34, 12, 34, 12],
};

function buzz(cue: Cue): void {
  if (!getPrefs().haptics) return;
  try {
    navigator.vibrate?.(BUZZES[cue]);
  } catch {
    // Not allowed here (an embedded page, a desktop browser): no matter.
  }
}

/**
 * A light tick under the thumb, with no sound: a tab changed, a sheet opened,
 * a card was placed. Phones only (no-op where the device cannot vibrate), and
 * only when the player left vibration on.
 */
export function tap(strength: "light" | "firm" = "light"): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  // Browsers refuse a buzz the player did not cause (a dialog that opens by itself).
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  if (!getPrefs().haptics) return;
  try {
    navigator.vibrate(strength === "light" ? 8 : 16);
  } catch {
    // Not allowed here: no matter.
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

/** When a try's verdict last sounded: the plain "move" tick for that same try stays quiet. */
let verdictAt = 0;

/** A win or a loss waiting out the verdict, so the two are not one noise. */
let endTimer: ReturnType<typeof setTimeout> | undefined;

function soon(name: Cue, wait: number): void {
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(() => {
    endTimer = undefined;
    play(name);
    buzz(name);
  }, wait);
}

/** Whether a hit, near, or miss sounded within `within` ms. */
export function heardVerdict(within = 600): boolean {
  return Date.now() - verdictAt < within;
}

/** A sound and a buzz for something that just happened. */
export function cue(name: Cue): void {
  const now = Date.now();
  if (name === "hit" || name === "near" || name === "miss") {
    if (endTimer) clearTimeout(endTimer);
    endTimer = undefined;
    verdictAt = now;
    play(name);
    buzz(name);
    return;
  }
  if (name === "move" && now - verdictAt < 600) return;
  // The last try of a puzzle is a verdict and a fanfare. Let the verdict land first.
  if ((name === "win" || name === "great" || name === "lose") && now - verdictAt < 500) {
    soon(name, 380);
    return;
  }
  play(name);
  buzz(name);
}

/**
 * The verdict cue for a plaque or chip tone ("on", "near", "off", "heat-N"…),
 * or undefined for a tone that is no verdict.
 */
export function cueOfTone(tone: string | undefined): Cue | undefined {
  if (!tone) return undefined;
  // Heat runs from a find (0, green) through warm (1–2) to cold (3–5).
  if (tone === "on" || tone === "hit" || tone === "success" || tone === "heat-0") return "hit";
  if (tone === "near" || tone === "heat-1" || tone === "heat-2") return "near";
  if (tone === "off" || tone === "miss" || tone === "danger" || /^heat-[345]$/.test(tone)) return "miss";
  return undefined;
}

/** Turns the sound on or off, and says so with a tick when it comes on. */
export function setSound(on: boolean): void {
  writeStore("prefs", { ...getPrefs(), sound: on });
  if (on) play("move");
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
