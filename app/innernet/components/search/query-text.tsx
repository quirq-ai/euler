import { tokens } from "./query-tools";

/** A query as typed, with operators such as lang:rust set in mono. */
export function QueryText({ q, opClassName = "font-mono text-[0.82em] not-italic" }: { q: string; opClassName?: string }) {
  return (
    <>
      {tokens(q).map((t, i) =>
        t.op ? (
          <span key={i} className={opClassName}>
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </>
  );
}
