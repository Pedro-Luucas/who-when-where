"use client";

import { useFocusWhenLost } from "@/lib/focus";

/** A round's question. Words wrapped in *asterisks* are emphasised. */
export function Question({ text }: { text: string }) {
  const heading = useFocusWhenLost<HTMLHeadingElement>();
  return (
    <h2 className="question" ref={heading} tabIndex={-1}>
      {text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
    </h2>
  );
}
