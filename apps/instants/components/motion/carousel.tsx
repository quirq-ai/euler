"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "@/components/instagram/shared";
import { motion, prefersReducedMotion } from "@/lib/motion";
import { nearestSlide, isDoubleTap } from "@/lib/motion-core.mjs";
import "./carousel.css";

export function MotionCarousel({
  images,
  alt,
  label = "Post photos",
  onDoubleTap,
  children,
  onIndexChange,
}: {
  images: string[];
  alt: string;
  label?: string;
  onDoubleTap?: () => void;
  children?: ReactNode;
  onIndexChange?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    id: number;
    type: string;
  } | null>(null);
  const suppressClick = useRef(false);
  const tap = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouch = useRef(0);
  const frame = useRef<number | null>(null);
  const onIndex = useRef(onIndexChange);
  onIndex.current = onIndexChange;
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let previousWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === previousWidth) return;
      previousWidth = element.clientWidth;
      element.scrollTo({
        left: indexRef.current * element.clientWidth,
        behavior: "instant",
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function goTo(next: number) {
    const element = track.current;
    if (!element) return;
    element.scrollTo({
      left:
        Math.max(0, Math.min(images.length - 1, next)) * element.clientWidth,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
  }
  function updateIndex() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = track.current;
      if (!el) return;
      const next = nearestSlide(el.scrollLeft, el.clientWidth, images.length);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
        onIndex.current?.(next);
      }
    });
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    suppressClick.current = false;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: track.current?.scrollLeft || 0,
      id: event.pointerId,
      type: event.pointerType,
    };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const from = drag.current,
      el = track.current;
    if (!from || !el || from.type !== "mouse") return;
    const dx = event.clientX - from.x;
    if (Math.abs(dx) > 5) {
      suppressClick.current = true;
      el.classList.add("dragging");
      if (!el.hasPointerCapture(event.pointerId))
        el.setPointerCapture(event.pointerId);
      el.scrollLeft = from.left - dx;
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const from = drag.current,
      el = track.current;
    drag.current = null;
    if (!from || !el) return;
    const wasDrag = el.classList.contains("dragging");
    el.classList.remove("dragging");
    if (el.hasPointerCapture(event.pointerId))
      el.releasePointerCapture(event.pointerId);
    if (wasDrag) {
      goTo(nearestSlide(el.scrollLeft, el.clientWidth, images.length));
      return;
    }
    if (
      from.type === "touch" &&
      Math.hypot(event.clientX - from.x, event.clientY - from.y) < 10
    ) {
      const current = {
        time: performance.now(),
        x: event.clientX,
        y: event.clientY,
      };
      lastTouch.current = current.time;
      if (isDoubleTap(tap.current, current, motion.gestures.doubleTapWindow)) {
        onDoubleTap?.();
        tap.current = null;
      } else tap.current = current;
    }
  }
  return (
    <div
      className="motion-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div
        ref={track}
        className="motion-carousel-track"
        tabIndex={0}
        onScroll={updateIndex}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => {
          drag.current = null;
          track.current?.classList.remove("dragging");
        }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDoubleClick={() => {
          if (
            !suppressClick.current &&
            performance.now() - lastTouch.current > 500
          )
            onDoubleTap?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            goTo(index + 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(index - 1);
          }
        }}
        aria-label="Swipe photos or use left and right arrow keys"
      >
        {images.map((src, i) => (
          <div
            className="motion-carousel-slide"
            key={`${src}-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${images.length}`}
          >
            <Photo
              src={src}
              alt={`${alt}${images.length > 1 ? ` - photo ${i + 1}` : ""}`}
              eager={i === 0}
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="slide-count">
            {index + 1}/{images.length}
          </span>
          {index > 0 && (
            <button
              className="carousel-arrow prev"
              aria-label="Previous photo"
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {index < images.length - 1 && (
            <button
              className="carousel-arrow next"
              aria-label="Next photo"
              onClick={() => goTo(index + 1)}
            >
              <ChevronRight size={16} />
            </button>
          )}
          <div className="motion-carousel-dots">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Show photo ${i + 1}`}
                aria-current={index === i ? "true" : undefined}
                onClick={() => goTo(i)}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        Photo {index + 1} of {images.length}
      </span>
      {children}
    </div>
  );
}
