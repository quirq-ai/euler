// Node-only adapter: never import this file from a client component.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  appendActivity,
  createSessionDocument,
  isSessionId,
  MAX_DOCUMENT_BYTES,
  parseSessionDocument,
  SessionError,
} from "./schema.mjs";

// A queue per session prevents overlapping requests in one local Node process
// from replacing each other's changes. Production requires a durable adapter.
const writeQueues = new Map();

async function serialize(key, operation) {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  writeQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (writeQueues.get(key) === current) writeQueues.delete(key);
  }
}

export function createSessionStore({
  directory = process.env.INSTANTS_SESSION_DIR || path.join(process.cwd(), "session"),
} = {}) {
  // Runtime journals are created on this machine, never deployment inputs.
  const root = path.resolve(/* turbopackIgnore: true */ directory);

  function filePath(id) {
    if (!isSessionId(id))
      throw new SessionError("invalid_session", "Invalid session ID.");
    return path.join(root, id, "session.json");
  }

  async function loadSession(id) {
    const file = filePath(id);
    let raw;
    try {
      const info = await stat(file);
      if (info.size > MAX_DOCUMENT_BYTES) {
        throw new SessionError(
          "session_full",
          "This session exceeds the storage limit.",
          413,
        );
      }
      raw = await readFile(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    let document;
    try {
      document = parseSessionDocument(JSON.parse(raw));
    } catch {
      throw new SessionError(
        "invalid_session",
        "The saved session could not be read. Its file has been preserved.",
        500,
      );
    }
    if (document.id !== id) {
      throw new SessionError(
        "invalid_session",
        "The saved session does not match this browser.",
        500,
      );
    }
    return document;
  }

  async function persist(document) {
    const file = filePath(document.id);
    const folder = path.dirname(file);
    const temp = path.join(folder, `.session-${randomUUID()}.tmp`);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    try {
      // Compact JSON keeps the serialized-byte limit consistent on disk.
      await writeFile(temp, JSON.stringify(document), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  }

  async function createSession() {
    const document = createSessionDocument(randomUUID());
    await persist(document);
    return document;
  }

  async function appendSession(id, events) {
    const file = filePath(id);
    return serialize(file, async () => {
      const document = await loadSession(id);
      if (!document)
        throw new SessionError(
          "session_missing",
          "Start a session before saving activity.",
          401,
        );
      const updated = appendActivity(document, events);
      if (updated.activity.length !== document.activity.length)
        await persist(updated);
      return updated;
    });
  }

  return { createSession, loadSession, appendSession };
}
