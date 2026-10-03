"use client";
import { useEffect, useState } from "react";
import { Check, Clock3, Zap } from "lucide-react";
import type { Instant } from "./shared";

export function InstantResponse({
  instant,
  selected,
  expiresAt,
  onRespond,
}: {
  instant: Instant;
  selected?: string;
  expiresAt?: number;
  onRespond: (option: string) => void;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds =
    expiresAt && now
      ? Math.min(
          instant.expiresInMinutes * 60,
          Math.max(0, Math.ceil((expiresAt - now) / 1000)),
        )
      : instant.expiresInMinutes * 60;
  const expired = seconds === 0;
  const remaining =
    seconds < 60 ? `${seconds}s left` : `${Math.ceil(seconds / 60)}m left`;
  const total =
    instant.options.reduce((sum, option) => sum + option.count, 0) +
    (selected ? 1 : 0);
  return (
    <section
      className={`instant-response instant-kind-${instant.kind} ${selected ? "responded" : ""}`}
      aria-label={instant.title}
    >
      <div className="instant-meta">
        <span className="instant-kind">
          <Zap size={12} fill="currentColor" />
          {instant.kind === "poll" ? "TEAM DECISION" : "INPUT NEEDED"}
        </span>
        <span className="instant-deadline">
          <Clock3 size={12} />
          {expired ? "Response window closed" : remaining}
        </span>
      </div>
      <h2>{instant.title}</h2>
      <div className="instant-options">
        {instant.options.map((option) => {
          const active = selected === option.id;
          const percentage =
            total > 0
              ? Math.round(((option.count + (active ? 1 : 0)) / total) * 100)
              : 0;
          return (
            <button
              key={option.id}
              className={`instant-option ${active ? "selected" : ""}`}
              disabled={expired}
              aria-pressed={active}
              onClick={() => onRespond(option.id)}
            >
              {selected && instant.kind === "poll" && (
                <span
                  className="vote-fill"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <span>
                {active && <Check size={15} strokeWidth={2.4} />} {option.label}
              </span>
              {selected && instant.kind === "poll" && (
                <strong>{percentage}%</strong>
              )}
            </button>
          );
        })}
      </div>
      <p className="instant-response-note" aria-live="polite">
        {selected ? (
          <>
            <Check size={12} />{" "}
            {instant.kind === "poll"
              ? "Your vote is recorded"
              : "Response recorded"}
            <span>&middot; {total} responses</span>
          </>
        ) : (
          <>
            <span className="response-dot" />
            {total} teammates responded<span>&middot; add your input</span>
          </>
        )}
      </p>
    </section>
  );
}
