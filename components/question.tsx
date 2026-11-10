/** A round's question. Words wrapped in *asterisks* are emphasised. */
export function Question({ text }: { text: string }) {
  return (
    <h2 className="question">
      {text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
    </h2>
  );
}
