// The share card of one finished puzzle: what goes into its address, and how
// the picture's route (app/play/[slug]/card/route.tsx) reads it back. Spoiler
// free, like the share text: the score, how each try went as a row of
// coloured squares, and the puzzle's label — never the answer.

export type CardVerdict = "hit" | "near" | "miss" | "skip";

const LETTER: Record<CardVerdict, string> = { hit: "h", near: "n", miss: "m", skip: "s" };
const FROM_LETTER: Record<string, CardVerdict> = { h: "hit", n: "near", m: "miss", s: "skip" };

/** At most this many squares (a long run of rounds still fits one row or two). */
export const CARD_SQUARES = 30;
const LABEL_MAX = 60;

export type CardData = {
  points: number;
  verdicts: CardVerdict[];
  /** "No. 12 — Today's dig", "Practice". */
  label: string;
  locale: "en" | "pt";
};

/** The query string of a card: ?p=740&v=hhnm&t=No.%2012&l=en */
export function cardQuery(card: CardData): string {
  const query = new URLSearchParams({
    p: String(Math.max(0, Math.min(1000, Math.round(card.points)))),
    v: card.verdicts
      .slice(0, CARD_SQUARES)
      .map((verdict) => LETTER[verdict])
      .join(""),
    t: card.label.slice(0, LABEL_MAX),
    l: card.locale,
  });
  return query.toString();
}

/** Reads a card back from its query; null when the address is not one. */
export function readCard(get: (name: string) => string | null): CardData | null {
  const points = Number(get("p"));
  if (!Number.isInteger(points) || points < 0 || points > 1000) return null;
  const verdicts = [...(get("v") ?? "")].slice(0, CARD_SQUARES).map((letter) => FROM_LETTER[letter]);
  if (verdicts.some((verdict) => !verdict)) return null;
  const locale = get("l") === "pt" ? "pt" : "en";
  // Plain words only: no control characters in the picture.
  const label = (get("t") ?? "").replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, LABEL_MAX);
  return { points, verdicts: verdicts as CardVerdict[], label, locale };
}

// The picture the result card is offering to send. Drawn when the card
// appears, so the share tap itself does not wait on a fetch (a wait there
// can miss the browser's gesture window and the sheet never opens).

type OfferedPicture = { ready: File | null };

let offered: OfferedPicture | null = null;

/** Starts drawing `href` into a PNG the next share can attach. */
export function offerSharePicture(href: string, name: string): void {
  const slot: OfferedPicture = { ready: null };
  offered = slot;
  void fetch(href)
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => {
      if (!blob || offered !== slot) return;
      slot.ready = new File([blob], name, { type: "image/png" });
    })
    .catch(() => {
      // No picture: the share goes out as text and a link.
    });
}

/** The picture, if it has finished drawing. Null until then, and after the card goes. */
export function sharePictureFile(): File | null {
  return offered?.ready ?? null;
}

/** Drops the picture when the result leaves the screen. */
export function clearSharePicture(): void {
  offered = null;
}
