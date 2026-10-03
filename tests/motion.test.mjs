import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySwipe,
  nearestSlide,
  isDoubleTap,
} from "../lib/motion-core.mjs";

test("horizontal stories require intent and ignore taps, jitter and diagonal scrolling", () => {
  assert.equal(classifySwipe(-100, 12), "left");
  assert.equal(classifySwipe(100, -12), "right");
  for (const [x, y] of [
    [0, 0],
    [43, 1],
    [80, 80],
    [NaN, 0],
    [0, Infinity],
  ]) {
    assert.equal(classifySwipe(x, y), null);
  }
});
test("vertical dismiss and reel gestures have a higher threshold", () => {
  assert.equal(classifySwipe(12, 95), null);
  assert.equal(classifySwipe(12, 96), "down");
  assert.equal(classifySwipe(-12, -96), "up");
  assert.equal(classifySwipe(-20, 0, 20), "left");
});
test("carousel snaps to the nearest valid slide even with elastic overscroll", () => {
  assert.equal(nearestSlide(-80, 390, 3), 0);
  assert.equal(nearestSlide(194, 390, 3), 0);
  assert.equal(nearestSlide(196, 390, 3), 1);
  assert.equal(nearestSlide(10000, 390, 3), 2);
  assert.equal(nearestSlide(100, 0, 3), 0);
  assert.equal(nearestSlide(NaN, 390, 3), 0);
});
test("double taps require two nearby taps within the configured time window", () => {
  const first = { time: 100, x: 10, y: 10 };
  assert.equal(isDoubleTap(null, first), false);
  assert.equal(isDoubleTap(first, { time: 380, x: 20, y: 20 }), true);
  assert.equal(isDoubleTap(first, { time: 381, x: 20, y: 20 }), false);
  assert.equal(isDoubleTap(first, { time: 200, x: 100, y: 20 }), false);
  assert.equal(isDoubleTap(first, { time: 90, x: 10, y: 10 }), false);
});
