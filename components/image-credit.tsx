// Who made a photo or portrait, under which licence, and where it lives: the
// attribution every Wikimedia Commons file asks for. Shown on the reveal only,
// so an author's name can never give the answer away. The data comes from
// scripts/fetch-image-credits.mjs (and fetch-people / fetch-sites).

export type ImageCreditData = {
  /** The file's name on Commons (or a Wikipedia). */
  file: string;
  author: string;
  /** "CC BY-SA 4.0", "Public domain"… */
  licence: string;
  licenceUrl: string | null;
  /** The file's page. */
  source: string;
};

type Props = {
  credit: ImageCreditData | undefined;
  labels: {
    /** "Photo", "Portrait". */
    kind: string;
    publicDomain: string;
    unknownAuthor: string;
    /** "Wikimedia Commons". */
    source: string;
  };
};

/** One small line: "Photo: Author · CC BY-SA 4.0 · Wikimedia Commons". */
export function ImageCredit({ credit, labels }: Props) {
  if (!credit) return null;
  const author = /^unknown author$/i.test(credit.author) ? labels.unknownAuthor : credit.author;
  const licence = /^public domain$/i.test(credit.licence) ? labels.publicDomain : credit.licence;
  return (
    <p className="bio-links image-credit">
      <span>
        {labels.kind}: {author}
        {" · "}
        {credit.licenceUrl ? (
          <a href={credit.licenceUrl} target="_blank" rel="noreferrer">
            {licence}
          </a>
        ) : (
          licence
        )}
        {" · "}
        <a href={credit.source} target="_blank" rel="noreferrer">
          {labels.source}
        </a>
      </span>
    </p>
  );
}
