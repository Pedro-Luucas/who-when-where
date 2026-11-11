type Props = {
  /** Whether the puzzle was solved; a lost one is stamped "×". */
  solved: boolean;
  /** Tries used, and tries allowed. */
  used: number;
  max: number;
  /** What a try is called under the stamp: "guesses", "digs". */
  unit: string;
  /** The verdict in a line: "Found in three". */
  headline: React.ReactNode;
  /** The answer, under the verdict. */
  children: React.ReactNode;
};

/** The head of a finished puzzle, the same in every game counted in tries: a stamp with the score, and the verdict. */
export function ResultHead({ solved, used, max, unit, headline, children }: Props) {
  return (
    <div className="result-head" role="status">
      <div className="stamp" data-lost={solved ? undefined : ""}>
        <strong>
          {solved ? used : "×"}/{max}
        </strong>
        <span>{unit}</span>
      </div>
      <div className="verdict-text">
        <p className="verdict-headline">{headline}</p>
        <p className="verdict-answer">{children}</p>
      </div>
    </div>
  );
}
