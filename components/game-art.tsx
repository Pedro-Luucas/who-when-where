import type { FamilyId } from "@/games/families";
import { cn } from "./ui/cn";
import { FamilyIcon } from "./ui/family-icon";

// Illustrated thumbnails for the catalogue, the dailies and the setup panel:
// one small scene per game, drawn in its family colour (--fam) on the night
// backdrop that .game-art paints in CSS. Pure SVG, no ids, so any number can
// share a page and the server can render them. A game without a scene of its
// own gets its family's mark.

const fam = "var(--fam)";
const ink = "var(--art-ink)";
const dim = "var(--art-dim)";

/** Faint landmasses, for scenes set on a map. */
function Land() {
  return (
    <g fill={dim}>
      <path d="M28 52c14-12 40-14 58-6 10 5 6 16 18 20 10 4 8 18-4 22-14 5-20 18-34 16-16-2-14-18-26-24-14-6-22-18-12-28z" />
      <path d="M92 118c10-4 22 0 26 10 4 12-2 22 2 34 2 8-6 14-14 8-10-8-12-20-18-30-4-8-4-18 4-22z" />
      <path d="M150 42c12-8 30-6 38 2 6 6 18 2 28 6 16 6 34 2 50 10 14 8 12 22-2 26-12 4-16 14-30 14-12 0-20-8-32-6-12 2-20 12-34 8-12-4-8-16-18-22-10-6-12-30 0-38z" />
      <path d="M168 104c12-4 24 2 26 14 2 10 10 18 6 30-4 12-18 16-26 6-6-8-4-20-10-28-6-10-6-18 4-22z" />
      <path d="M252 132c10-6 26-4 32 6 4 8-2 16-12 16-12 0-30-12-20-22z" />
    </g>
  );
}

const SCENES: Record<string, React.ReactNode> = {
  // A portrait card, a life arc from birthplace to deathplace, the years.
  "who-when-where": (
    <>
      <Land />
      <rect x="26" y="34" width="78" height="100" rx="6" fill="var(--art-card)" stroke={fam} strokeOpacity=".7" />
      <circle cx="65" cy="72" r="17" fill={fam} fillOpacity=".85" />
      <path d="M38 128c4-20 14-30 27-30s23 10 27 30z" fill={fam} fillOpacity=".85" />
      <rect x="26" y="142" width="78" height="20" rx="4" fill="var(--art-card)" stroke={fam} strokeOpacity=".5" />
      <text x="65" y="156" textAnchor="middle" className="game-art-text">
        1809–1882
      </text>
      <path d="M150 128C178 60 236 52 270 88" fill="none" stroke={fam} strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" />
      <circle cx="150" cy="128" r="7" fill={ink} stroke={fam} strokeWidth="3" />
      <path d="M270 96s-14-13-14-24a14 14 0 0 1 28 0c0 11-14 24-14 24z" fill={fam} />
      <circle cx="270" cy="72" r="5" fill="var(--art-card)" />
    </>
  ),
  // A voyage drawn a stretch at a time.
  wayfarer: (
    <>
      <Land />
      <path
        d="M40 150c30-6 44-32 70-40s46 10 70-6 30-44 58-50 34 4 44 0"
        fill="none"
        stroke={fam}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="10 7"
      />
      {[
        [40, 150],
        [110, 110],
        [180, 104],
        [238, 54],
      ].map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r="5.5" fill={ink} stroke={fam} strokeWidth="2.5" />
      ))}
      <circle cx="282" cy="54" r="22" fill="none" stroke={fam} strokeOpacity=".5" strokeWidth="1.5" />
      <path d="M282 36l5 18-5 18-5-18z" fill={fam} />
      <path d="M264 54h36" stroke={fam} strokeOpacity=".5" strokeWidth="1.5" />
      <text x="282" y="31" textAnchor="middle" className="game-art-text">
        N
      </text>
    </>
  ),
  // Rings narrowing in on a buried city.
  "dig-site": (
    <>
      <Land />
      {[74, 52, 32].map((r, i) => (
        <circle key={r} cx="170" cy="104" r={r} fill="none" stroke={fam} strokeOpacity={0.35 + i * 0.22} strokeWidth="2" strokeDasharray={i === 2 ? undefined : "4 6"} />
      ))}
      <path d="M160 94l20 20M180 94l-20 20" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path d="M232 52l30 30" stroke={fam} strokeWidth="5" strokeLinecap="round" />
      <path d="M252 40c10 2 18 10 20 20l-14-6-6-14z" fill={fam} />
      <rect x="38" y="134" width="58" height="34" rx="4" fill="var(--art-card)" stroke={fam} strokeOpacity=".5" />
      <path d="M44 162l14-16 10 10 8-6 14 12z" fill={fam} fillOpacity=".8" />
      <circle cx="82" cy="144" r="4" fill={fam} fillOpacity=".8" />
    </>
  ),
  // Six moments, set in order on a timeline.
  "first-to-last": (
    <>
      <path d="M30 140h260" stroke={fam} strokeOpacity=".55" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 46 + i * 46;
        const y = i % 2 ? 70 : 92;
        return (
          <g key={i}>
            <path d={`M${x} 140V${y + 26}`} stroke={fam} strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="2 4" />
            <rect x={x - 18} y={y} width="36" height="26" rx="4" fill="var(--art-card)" stroke={fam} strokeOpacity={i < 3 ? 0.9 : 0.4} />
            <circle cx={x} cy="140" r="9" fill={i < 3 ? fam : ink} stroke={fam} strokeWidth="2" />
            <text x={x} y="144" textAnchor="middle" className="game-art-badge" data-on={i < 3 ? "" : undefined}>
              {i + 1}
            </text>
          </g>
        );
      })}
      <path d="M30 172h96" stroke={fam} strokeWidth="3" strokeLinecap="round" />
      <path d="M126 166l10 6-10 6z" fill={fam} />
    </>
  ),
  // A chain of neighbouring countries, from one end to the other.
  overland: (
    <>
      <path d="M30 120l22-30 30 6 10 26-18 26-30-4z" fill={fam} fillOpacity=".9" />
      <path d="M92 122l18-34 34 4 8 30-24 22-28-6z" fill={fam} fillOpacity=".45" stroke={fam} strokeOpacity=".8" />
      <path d="M152 92l36-10 24 22-6 30-32 6-14-18z" fill={fam} fillOpacity=".45" stroke={fam} strokeOpacity=".8" />
      <path d="M212 104l36-20 30 18-4 34-30 14-26-14z" fill={dim} stroke={fam} strokeOpacity=".5" strokeDasharray="4 5" />
      <path d="M248 60l34 6 6 26-30 6-14-20z" fill={fam} fillOpacity=".9" />
      <path d="M62 116C118 70 190 160 270 80" fill="none" stroke={ink} strokeWidth="2.5" strokeDasharray="1 7" strokeLinecap="round" />
      <circle cx="62" cy="116" r="6" fill={ink} />
      <circle cx="268" cy="80" r="6" fill={ink} />
    </>
  ),
  // A country cut out of the map, waiting to be named.
  outline: (
    <>
      <Land />
      <path
        d="M120 44l30 8 22-10 28 18 6 26 26 14-8 28-30 8-10 26-30-4-18-22-28 2-12-28 10-24-12-20z"
        fill={fam}
        fillOpacity=".9"
        stroke={ink}
        strokeOpacity=".6"
        strokeWidth="2"
      />
      <text x="168" y="124" textAnchor="middle" className="game-art-mark">
        ?
      </text>
      <path d="M262 150l-18-12" stroke={fam} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="270" cy="156" r="10" fill="none" stroke={fam} strokeWidth="2.5" />
    </>
  ),
};

type Props = {
  slug: string;
  family: FamilyId;
  className?: string;
  /** A word or two drawn over the scene, top left: today's prompt, a variant. */
  caption?: string;
};

/** A game's thumbnail: its scene, or its family's mark when it has none yet. Decorative. */
export function GameArt({ slug, family, className, caption }: Props) {
  const scene = SCENES[slug];
  return (
    <span
      className={cn("game-art", className)}
      data-family={family}
      style={{ "--fam": `var(--color-family-${family})` } as React.CSSProperties}
      aria-hidden="true"
    >
      {scene ? (
        <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
          {scene}
        </svg>
      ) : (
        <FamilyIcon family={family} className="game-art-fallback" />
      )}
      {caption && <span className="game-art-caption">{caption}</span>}
    </span>
  );
}
