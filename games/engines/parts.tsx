"use client";

import { flagSrc } from "@/lib/geo-data";
import { formatYear, type Locale } from "@/lib/i18n";

// Small pieces the engine games share: lifespans on one axis, a monogram
// where there is no portrait, a flag, and the line that credits a source.

export type Life = { id: string; name: string; born: number; died: number };

/** "1809–1882", "c. 427–347 BC" for lives wholly before Christ. */
export function lifeYears(born: number, died: number, locale: Locale): string {
  if (born < 0 && died < 0) return `${-born}–${formatYear(died, locale)}`;
  return `${formatYear(born, locale)}–${formatYear(died, locale)}`;
}

/** Lifespans on a shared axis; with `overlap`, the years all of them were alive are marked. */
export function Lifelines({ lives, locale, overlap = false, label }: { lives: Life[]; locale: Locale; overlap?: boolean; label: string }) {
  if (!lives.length) return null;
  const first = Math.min(...lives.map((life) => life.born));
  const last = Math.max(...lives.map((life) => life.died));
  const pad = Math.max(5, Math.round((last - first) * 0.04));
  const from = first - pad;
  const span = last + pad - from;
  const at = (year: number) => `${((year - from) / span) * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(b - a, 0.6) / span) * 100}%`;
  const sharedFrom = Math.max(...lives.map((life) => life.born));
  const sharedTo = Math.min(...lives.map((life) => life.died));
  const shared = overlap && sharedTo > sharedFrom;

  return (
    <figure className="lifelines" aria-label={label}>
      <figcaption className="lifelines-axis">
        <span>{formatYear(first, locale)}</span>
        <span className="eyebrow">{label}</span>
        <span>{formatYear(last, locale)}</span>
      </figcaption>
      {lives.map((life) => (
        <div className="lifeline" key={life.id}>
          <span className="lifeline-name">
            {life.name} <span className="lifeline-years">{lifeYears(life.born, life.died, locale)}</span>
          </span>
          <span className="lifeline-track" aria-hidden="true">
            <i className="lifeline-bar" style={{ left: at(life.born), width: width(life.born, life.died) }} />
            {shared && <i className="lifeline-overlap" style={{ left: at(sharedFrom), width: width(sharedFrom, sharedTo) }} />}
          </span>
        </div>
      ))}
    </figure>
  );
}

/** "AL" for Ada Lovelace: a stand-in for a portrait. */
export function Monogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter((word) => /^\p{Lu}/u.test(word))
    .map((word) => word[0])
    .join("");
  return (
    <span className="monogram" aria-hidden="true">
      {(letters.length > 2 ? letters[0] + letters.at(-1) : letters || name[0]).toUpperCase()}
    </span>
  );
}

/** A person as a card, without their dates: monogram, name, and a line on who they were. */
export function PersonCard({ name, note }: { name: string; note?: string }) {
  return (
    <div className="person-card">
      <Monogram name={name} />
      <span>
        <b>{name}</b>
        {note && <small>{note}</small>}
      </span>
    </div>
  );
}

/** A country's flag. `alt` is empty where the flag must not give the country away. */
export function Flag({ id, alt = "", className }: { id: string; alt?: string; className?: string }) {
  // Plain <img>: the flags are small SVGs served as they are, and next/image would not resize an SVG.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className ? `flag ${className}` : "flag"} src={flagSrc(id)} alt={alt} loading="lazy" decoding="async" />;
}

/** "Data: World Bank Open Data · CC BY 4.0". */
export function SourceLine({ label, name, href, licence }: { label: string; name: string; href: string; licence?: string }) {
  return (
    <p className="source-line">
      {label}:{" "}
      <a href={href} target="_blank" rel="noreferrer">
        {name}
      </a>
      {licence && <> · {licence}</>}
    </p>
  );
}
