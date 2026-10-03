import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  appendActivity,
  createSessionDocument,
  isSessionId,
  MAX_EVENTS,
  parseActivityBatch,
  parseSessionDocument,
  SessionError,
} from "../engine/schema.mjs";
import { createSessionStore } from "../engine/session-store.mjs";
import { hasSameOrigin } from "../engine/http.mjs";

const now = "2026-10-03T10:00:00.000Z";
const event = (type = "post.like", data = { postId: "p1", liked: true }) => ({
  id: randomUUID(),
  type,
  at: now,
  data,
});
const empty = () => createSessionDocument(randomUUID(), now);

test("same-origin checks use the addressed host and reject foreign or malformed origins", () => {
  assert.equal(
    hasSameOrigin(
      "http://localhost:5180/api/session",
      "http://127.0.0.1:5180",
      "127.0.0.1:5180",
    ),
    true,
  );
  assert.equal(
    hasSameOrigin(
      "https://internal:3000/api/session",
      "https://instants.example",
      "instants.example",
    ),
    true,
  );
  for (const origin of [
    null,
    "null",
    "https://other.example",
    "http://127.0.0.1:5181",
    "http://localhost:5180",
    "http://127.0.0.1:5180/path",
  ]) {
    assert.equal(
      hasSameOrigin(
        "http://localhost:5180/api/session",
        origin,
        "127.0.0.1:5180",
      ),
      false,
    );
  }
  for (const host of [
    null,
    "good.example@other.example",
    "other.example/path",
    "other.example\\private",
  ]) {
    assert.equal(
      hasSameOrigin(
        "https://internal/api/session",
        "https://other.example",
        host,
      ),
      false,
    );
  }
});

async function tempStore(t) {
  const parent = path.resolve(".sites-runtime", "session-tests");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "instants-session-test-"));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith("instants-session-test-"));
    await rm(resolved, { recursive: true, force: true });
  });
  return { directory, store: createSessionStore({ directory }) };
}

test("the activity contract accepts each supported action", () => {
  const cases = [
    event(),
    event("post.save", { postId: "p1", saved: true }),
    event("person.follow", { userId: "ella", following: false }),
    event("post.respond", { postId: "p1", optionId: "approved" }),
    event("post.comment", { postId: "p1", text: "Looks good." }),
    event("message.send", { userId: "james", text: "Ready to review?" }),
    event("message.read", { userId: "james" }),
    event("queue.reply", {
      itemId: "q1",
      userId: "james",
      kind: "review",
      postId: "p1",
      text: "Tested on mobile.",
    }),
    event("queue.resolve", { itemId: "q1", resolved: true }),
    event("post.create", {
      post: {
        id: "local-123",
        userId: "you",
        companyId: "quirq_ai",
        requesterId: "you",
        location: "Design review",
        time: "now",
        images: ["/work/preview.svg"],
        alt: "Preview of the new flow",
        caption: "Try the onboarding flow.",
        tags: "#review",
        likes: 0,
        commentCount: 0,
        comments: [],
        workType: "review",
        instant: {
          kind: "poll",
          title: "Ready to ship?",
          expiresInMinutes: 30,
          options: [
            { id: "yes", label: "Ready", count: 0 },
            { id: "no", label: "Needs work", count: 0 },
          ],
        },
      },
    }),
  ];
  assert.deepEqual(parseActivityBatch({ events: cases }), cases);
});

test("validation rejects unsafe identifiers, unknown payload keys, oversized and blank messages", () => {
  const invalid = [
    { ...event(), id: "../other-session" },
    { ...event(), at: "not-a-date" },
    event("post.like", { postId: "../../private", liked: true }),
    event("message.send", { userId: "james", text: "   " }),
    event("message.send", { userId: "james", text: "x".repeat(4_001) }),
    event("message.send", {
      userId: "james",
      text: "Hello",
      actor: "another-user",
    }),
    event("unsupported", {}),
    event("queue.reply", {
      itemId: "q1",
      userId: "james",
      kind: "script",
      text: "Hi",
    }),
  ];
  for (const value of invalid) {
    assert.throws(() => parseActivityBatch({ events: [value] }), SessionError);
  }
  assert.equal(isSessionId("../private"), false);
  assert.throws(() => parseActivityBatch({ events: [] }), SessionError);
  assert.throws(
    () =>
      parseActivityBatch({ events: Array.from({ length: 51 }, () => event()) }),
    SessionError,
  );
});

test("journal appends are immutable, idempotent, and detect event-ID reuse", () => {
  const initial = empty();
  const liked = event();
  const later = "2026-10-03T10:01:00.000Z";
  const updated = appendActivity(initial, [liked, liked], later);
  assert.equal(initial.activity.length, 0);
  assert.equal(updated.activity.length, 1);
  assert.equal(updated.updatedAt, later);
  assert.deepEqual(
    appendActivity(updated, [liked], "2026-10-03T11:00:00.000Z"),
    updated,
  );
  assert.throws(
    () =>
      appendActivity(updated, [
        { ...liked, data: { postId: "p1", liked: false } },
      ]),
    (error) => error.code === "event_conflict" && error.status === 409,
  );
});

test("created work cannot impersonate another author or embed script URLs", () => {
  const post = {
    id: "local-1",
    userId: "you",
    location: "Review",
    time: "now",
    images: ["/work/preview.svg"],
    alt: "Work preview",
    caption: "Please test the flow.",
    tags: "",
    likes: 0,
    commentCount: 0,
    comments: [],
  };
  for (const image of [
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "//other.example/private",
    "file:///private/image.png",
  ]) {
    assert.throws(
      () =>
        parseActivityBatch({
          events: [
            event("post.create", { post: { ...post, images: [image] } }),
          ],
        }),
      SessionError,
    );
  }
  assert.throws(
    () =>
      parseActivityBatch({
        events: [event("post.create", { post: { ...post, userId: "james" } })],
      }),
    SessionError,
  );
});

test("full or invalid sessions are rejected without trimming old activity", () => {
  const full = {
    ...empty(),
    activity: Array.from({ length: MAX_EVENTS }, () => event()),
  };
  assert.throws(
    () => appendActivity(full, [event()]),
    (error) => error.code === "session_full" && error.status === 413,
  );
  assert.equal(full.activity.length, MAX_EVENTS);
  assert.throws(
    () => parseSessionDocument({ ...empty(), userId: "someone-else" }),
    SessionError,
  );
  const duplicate = event();
  assert.throws(
    () =>
      parseSessionDocument({ ...empty(), activity: [duplicate, duplicate] }),
    SessionError,
  );
  assert.throws(() => createSessionDocument("../../other"), SessionError);
});

test("local sessions persist across store instances and remain separate", async (t) => {
  const { directory, store } = await tempStore(t);
  const first = await store.createSession();
  const second = await store.createSession();
  assert.notEqual(first.id, second.id);
  await store.appendSession(first.id, [
    event("message.send", { userId: "james", text: "Private draft reply" }),
  ]);
  const restarted = createSessionStore({ directory });
  const saved = await restarted.loadSession(first.id);
  assert.equal(saved.activity[0].data.text, "Private draft reply");
  assert.equal((await restarted.loadSession(second.id)).activity.length, 0);
  assert.deepEqual(await readdir(path.join(directory, first.id)), [
    "session.json",
  ]);
  const raw = JSON.parse(
    await readFile(path.join(directory, first.id, "session.json"), "utf8"),
  );
  assert.deepEqual(raw, saved);
});

test("concurrent appends and retries do not lose or duplicate events", async (t) => {
  const { directory, store } = await tempStore(t);
  const session = await store.createSession();
  const alternate = createSessionStore({ directory });
  const events = Array.from({ length: 25 }, (_, index) =>
    event("post.comment", { postId: "p1", text: `Comment ${index}` }),
  );
  await Promise.all(
    events.map((item, index) =>
      (index % 2 ? store : alternate).appendSession(session.id, [item]),
    ),
  );
  await Promise.all(
    events.map((item) => store.appendSession(session.id, [item])),
  );
  const saved = await store.loadSession(session.id);
  assert.equal(saved.activity.length, 25);
  assert.deepEqual(
    new Set(saved.activity.map((item) => item.id)),
    new Set(events.map((item) => item.id)),
  );
});

test("failed appends preserve the journal and do not block later writes", async (t) => {
  const { store } = await tempStore(t);
  const session = await store.createSession();
  const first = event();
  await store.appendSession(session.id, [first]);
  await assert.rejects(
    store.appendSession(session.id, [
      { ...first, data: { postId: "p1", liked: false } },
    ]),
    (error) => error.code === "event_conflict",
  );
  await store.appendSession(session.id, [
    event("post.save", { postId: "p2", saved: true }),
  ]);
  assert.equal((await store.loadSession(session.id)).activity.length, 2);
  await assert.rejects(store.loadSession("../../../elsewhere"), SessionError);
  await assert.rejects(
    store.appendSession(randomUUID(), [event()]),
    (error) => error.status === 401,
  );
});

test("corrupted files are reported and preserved instead of silently reset", async (t) => {
  const { directory, store } = await tempStore(t);
  const session = await store.createSession();
  const filename = path.join(directory, session.id, "session.json");
  await writeFile(filename, "{broken-json", "utf8");
  await assert.rejects(
    store.loadSession(session.id),
    (error) => error.code === "invalid_session" && error.status === 500,
  );
  assert.equal(await readFile(filename, "utf8"), "{broken-json");
});
