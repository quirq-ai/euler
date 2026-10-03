"use client";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion } from "./motion-tokens";
import { classifySwipe } from "./motion-core.mjs";
export { motion };
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "instant" : "smooth",
  });
}
export function useSwipeGesture(
  callbacks: {
    onLeft?: () => void;
    onRight?: () => void;
    onDown?: () => void;
    onUp?: () => void;
    onHold?: (held: boolean) => void;
  },
  enabled = true,
) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) {
      start.current = null;
      if (hold.current) clearTimeout(hold.current);
      hold.current = null;
      latest.current.onHold?.(false);
    }
  }, [enabled]);
  function stopHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
    latest.current.onHold?.(false);
  }
  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current);
    },
    [],
  );
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (
        !enabled ||
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as HTMLElement).closest(
          "button,input,textarea,a,[role=button]",
        )
      )
        return;
      start.current = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      hold.current = setTimeout(() => latest.current.onHold?.(true), 180);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (
        start.current &&
        Math.hypot(
          event.clientX - start.current.x,
          event.clientY - start.current.y,
        ) > 10 &&
        hold.current
      ) {
        clearTimeout(hold.current);
        hold.current = null;
      }
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      stopHold();
      if (!from || from.id !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      const direction = classifySwipe(
        event.clientX - from.x,
        event.clientY - from.y,
        motion.gestures.swipeThreshold,
        motion.gestures.verticalDismissThreshold,
        motion.gestures.axisDominance,
      );
      if (direction === "left") latest.current.onLeft?.();
      if (direction === "right") latest.current.onRight?.();
      if (direction === "down") latest.current.onDown?.();
      if (direction === "up") latest.current.onUp?.();
    },
    onPointerCancel() {
      start.current = null;
      stopHold();
    },
  };
}
