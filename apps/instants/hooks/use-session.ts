"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendActivity,
  createSessionDocument,
  MAX_BATCH_EVENTS,
  MAX_EVENTS,
  parseActivityBatch,
  parseSessionDocument,
} from "@/engine/schema.mjs";
import type {
  Activity,
  ActivityInput,
  SessionDocument,
  SessionResult,
} from "@/engine/types";
import { projectSession } from "@/engine/projection";
import { mock } from "@/lib/data";
const DEVICE_KEY = "instants-session-v1";
const outboxKey = (id: string) => "instants-outbox:" + id;
type Mode = "loading" | "file" | "browser" | "unavailable";
type Status = "loading" | "saved" | "saving" | "error";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function responseMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}
function parseResult(value: unknown): SessionResult {
  if (isRecord(value) && value.mode === "file")
    return { mode: "file", session: parseSessionDocument(value.session) };
  if (isRecord(value) && value.mode === "browser" && value.session === null)
    return { mode: "browser", session: null };
  throw new Error(
    "The session service returned an invalid response. Please retry.",
  );
}
function appendAll(document: SessionDocument, events: Activity[]) {
  let next = document;
  for (let index = 0; index < events.length; index += MAX_BATCH_EVENTS)
    next = appendActivity(next, events.slice(index, index + MAX_BATCH_EVENTS));
  return next;
}
function parseOutbox(raw: string): Activity[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_EVENTS)
    throw new Error(
      "The saved outbox could not be read. Export a backup before clearing it.",
    );
  const events: Activity[] = [];
  for (let index = 0; index < value.length; index += MAX_BATCH_EVENTS)
    events.push(
      ...parseActivityBatch({
        events: value.slice(index, index + MAX_BATCH_EVENTS),
      }),
    );
  return events;
}
/** Keep persisted order, then retain missing events from this tab.
 * A reset or account change must never blend different session identities. */
function mergeBrowserSession(stored: SessionDocument, local: SessionDocument) {
  if (
    stored.id !== local.id ||
    stored.userId !== local.userId ||
    stored.createdAt !== local.createdAt
  )
    throw new Error(
      "Your device session changed in another tab. Export a backup, then reload this tab.",
    );
  const known = new Map(stored.activity.map((event) => [event.id, event]));
  const missing: Activity[] = [];
  for (const event of local.activity) {
    const existing = known.get(event.id);
    if (!existing) missing.push(event);
    else if (JSON.stringify(existing) !== JSON.stringify(event))
      throw new Error(
        "Conflicting activity was found on this device. Export a backup before continuing.",
      );
  }
  return appendAll(stored, missing);
}
function latestBrowserSession(local: SessionDocument) {
  const raw = localStorage.getItem(DEVICE_KEY);
  if (!raw)
    throw new Error(
      "Your device session was cleared in another tab. Export a backup, then reload this tab.",
    );
  return mergeBrowserSession(parseSessionDocument(JSON.parse(raw)), local);
}
/** The only UI boundary for activity, projection, and persistence. */
export function useSession() {
  const [session, setSession] = useState<SessionDocument | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const current = useRef<SessionDocument | null>(null);
  const currentMode = useRef<Mode>("loading");
  const pending = useRef<Activity[]>([]);
  const recoveredRaw = useRef<string | null>(null);
  const alive = useRef(false);
  const generation = useRef(0);
  const openingRequest = useRef<AbortController | null>(null);
  const savingRequest = useRef<AbortController | null>(null);
  const publish = useCallback((next: SessionDocument) => {
    if (!alive.current) return;
    current.current = next;
    setSession(next);
  }, []);
  const fail = useCallback((message: string) => {
    if (alive.current) {
      setError(message);
      setStatus("error");
    }
  }, []);
  const flush = useCallback(async () => {
    if (
      savingRequest.current ||
      currentMode.current !== "file" ||
      !current.current ||
      !pending.current.length
    )
      return;
    const controller = new AbortController();
    savingRequest.current = controller;
    const ownGeneration = generation.current;
    const sessionId = current.current.id;
    const active = () =>
      alive.current &&
      !controller.signal.aborted &&
      generation.current === ownGeneration;
    setStatus("saving");
    setError("");
    try {
      while (pending.current.length && active()) {
        // One event per request bounds payloads containing image data.
        const batch = pending.current.slice(0, 1);
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!active()) return;
        if (!response.ok)
          throw new Error(
            responseMessage(
              payload,
              "Could not save your activity. Retry or export a backup.",
            ),
          );
        const result = parseResult(payload);
        if (result.mode !== "file" || result.session.id !== sessionId) {
          currentMode.current = "unavailable";
          setMode("unavailable");
          throw new Error(
            "Your session changed while saving. Export a backup, then reload this tab.",
          );
        }
        const acknowledged = new Set(batch.map((event) => event.id));
        const remaining = pending.current.filter(
          (event) => !acknowledged.has(event.id),
        );
        const saved = appendAll(result.session, remaining);
        pending.current = remaining;
        publish(saved);
        try {
          if (remaining.length)
            localStorage.setItem(
              outboxKey(sessionId),
              JSON.stringify(remaining),
            );
          else localStorage.removeItem(outboxKey(sessionId));
        } catch {
          /* Server acknowledgement remains the source of truth. */
        }
      }
      if (active()) {
        setStatus("saved");
        setError("");
      }
    } catch (cause) {
      if (active())
        fail(
          cause instanceof Error
            ? cause.message
            : "Could not save your activity. Retry or export a backup.",
        );
    } finally {
      if (savingRequest.current === controller) savingRequest.current = null;
    }
  }, [fail, publish]);
  const initialize = useCallback(async () => {
    openingRequest.current?.abort();
    savingRequest.current?.abort();
    savingRequest.current = null;
    const controller = new AbortController();
    openingRequest.current = controller;
    const ownGeneration = ++generation.current;
    const active = () =>
      alive.current &&
      !controller.signal.aborted &&
      generation.current === ownGeneration;
    if (active()) {
      setStatus("loading");
      setError("");
    }
    try {
      const response = await fetch("/api/session", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!active()) return;
      if (!response.ok)
        throw new Error(
          responseMessage(
            payload,
            "Your session could not be opened. Please retry.",
          ),
        );
      const result = parseResult(payload);
      let next: SessionDocument;
      let recovered: Activity[] = [];
      if (result.mode === "file") {
        next = result.session;
        let raw: string | null = null;
        try {
          raw = localStorage.getItem(outboxKey(next.id));
        } catch {
          /* File sessions work when browser storage is disabled. */
        }
        if (raw) {
          recoveredRaw.current = raw;
          recovered = parseOutbox(raw);
          next = appendAll(next, recovered);
        }
      } else {
        const raw = localStorage.getItem(DEVICE_KEY);
        recoveredRaw.current = raw;
        next = raw
          ? parseSessionDocument(JSON.parse(raw))
          : createSessionDocument(crypto.randomUUID());
        if (!raw) localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
      }
      if (!active()) return;
      pending.current = recovered;
      currentMode.current = result.mode;
      setMode(result.mode);
      publish(next);
      setStatus("saved");
      recoveredRaw.current = null;
      if (pending.current.length) void flush();
    } catch (cause) {
      if (!active()) return;
      currentMode.current = "unavailable";
      setMode("unavailable");
      fail(
        cause instanceof Error
          ? cause.message
          : "Your session could not be opened. Please retry.",
      );
    } finally {
      if (openingRequest.current === controller) openingRequest.current = null;
    }
  }, [fail, flush, publish]);
  useEffect(() => {
    alive.current = true;
    void initialize();
    const online = () => {
      void flush();
    };
    const storage = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== DEVICE_KEY && event.key !== null) ||
        currentMode.current !== "browser" ||
        !current.current
      )
        return;
      try {
        // Read current storage, since the delivered event may already be stale.
        const next = latestBrowserSession(current.current);
        const serialized = JSON.stringify(next);
        if (localStorage.getItem(DEVICE_KEY) !== serialized)
          localStorage.setItem(DEVICE_KEY, serialized);
        publish(next);
        setStatus("saved");
        setError("");
      } catch (cause) {
        currentMode.current = "unavailable";
        setMode("unavailable");
        fail(
          cause instanceof Error
            ? cause.message
            : "The device session could not be read. Export a backup before continuing.",
        );
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("storage", storage);
    return () => {
      alive.current = false;
      generation.current += 1;
      openingRequest.current?.abort();
      savingRequest.current?.abort();
      openingRequest.current = null;
      savingRequest.current = null;
      window.removeEventListener("online", online);
      window.removeEventListener("storage", storage);
    };
  }, [initialize, flush, fail, publish]);
  const recordBatch = useCallback(
    (inputs: ActivityInput[]): boolean => {
      const document = current.current;
      if (!document || !["browser", "file"].includes(currentMode.current)) {
        fail(
          "Your session is not ready. Retry opening it before making changes.",
        );
        return false;
      }
      try {
        const at = new Date().toISOString();
        const events = parseActivityBatch({
          events: inputs.map((input) => ({
            ...input,
            id: crypto.randomUUID(),
            at,
          })),
        });
        const base =
          currentMode.current === "browser"
            ? latestBrowserSession(document)
            : document;
        // Validate the whole action before publishing or enqueuing any part.
        const next = appendActivity(base, events);
        if (currentMode.current === "browser") {
          // A failed quota write must not appear as a successful reply.
          localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
          publish(next);
          setStatus("saved");
          setError("");
        } else {
          const queued = [...pending.current, ...events];
          try {
            localStorage.setItem(outboxKey(next.id), JSON.stringify(queued));
          } catch {
            /* Attempt the server write and show Saving until acknowledged. */
          }
          pending.current = queued;
          publish(next);
          setStatus("saving");
          void flush();
        }
        return true;
      } catch (cause) {
        fail(
          cause instanceof Error
            ? cause.message
            : "Activity could not be saved. Export your session to keep a backup.",
        );
        return false;
      }
    },
    [fail, flush, publish],
  );
  const record = useCallback(
    (input: ActivityInput) => recordBatch([input]),
    [recordBatch],
  );
  const retry = () => {
    if (!current.current || currentMode.current === "unavailable") {
      void initialize();
      return;
    }
    if (currentMode.current === "file") {
      if (pending.current.length) void flush();
      else {
        setStatus("saved");
        setError("");
      }
      return;
    }
    try {
      const next = latestBrowserSession(current.current);
      localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
      publish(next);
      setStatus("saved");
      setError("");
    } catch (cause) {
      fail(
        cause instanceof Error
          ? cause.message
          : "Device storage is unavailable or full. Export your session to keep a backup.",
      );
    }
  };
  const exportSession = () => {
    const value = current.current
      ? JSON.stringify(current.current, null, 2)
      : recoveredRaw.current;
    if (!value) return;
    const url = URL.createObjectURL(
      new Blob([value], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "instants-session-" + (current.current?.id || "recovery") + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const state = useMemo(() => projectSession(mock, session), [session]);
  return {
    session,
    state,
    record,
    recordBatch,
    mode,
    status,
    error,
    retry,
    exportSession,
    ready: mode !== "loading",
    label:
      status === "saving"
        ? "Saving activity…"
        : status === "error"
          ? "Activity needs attention"
          : mode === "file"
            ? "Saved locally"
            : mode === "browser"
              ? "Saved on this device"
              : "Opening your session…",
  };
}
