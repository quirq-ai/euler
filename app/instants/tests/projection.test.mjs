import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { appendActivity, createSessionDocument } from "../engine/schema.mjs";

// Test the shipped pure TypeScript projection without a Next runtime or a new
// loader dependency. Its type-only imports disappear; typecheck runs separately.
const source = readFileSync(
  new URL("../engine/projection.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { projectSession } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
const seed = deepFreeze(
  JSON.parse(
    readFileSync(new URL("../data/mock.json", import.meta.url), "utf8"),
  ),
);
const startedAt = "2026-10-03T10:00:00.000Z";
const actionAt = "2026-10-03T10:01:00.000Z";
const event = (type, data, at = actionAt) => ({
  id: randomUUID(),
  type,
  at,
  data,
});
const journal = (...events) => {
  const empty = createSessionDocument(randomUUID(), startedAt);
  const recordedAt = new Date(
    Math.max(
      Date.parse(actionAt),
      ...events.map((entry) => Date.parse(entry.at)),
    ),
  ).toISOString();
  return events.length ? appendActivity(empty, events, recordedAt) : empty;
};
const queueReply = (item, text) =>
  event("queue.reply", {
    itemId: item.id,
    userId: item.userId,
    kind: item.kind,
    ...(item.postId ? { postId: item.postId } : {}),
    text,
  });

test("sample work and attention requests refer to valid people, companies, and posts", () => {
  const users = new Set(["you", ...seed.users.map((user) => user.id)]);
  const companies = new Set(seed.companies.map((company) => company.id));
  const posts = new Set(seed.posts.map((post) => post.id));
  assert.deepEqual([...companies].sort(), ["quirq_ai", "xo_builders"]);
  assert.equal(
    new Set(seed.attention.map((item) => item.id)).size,
    seed.attention.length,
  );
  for (const user of seed.users) assert.ok(companies.has(user.companyId));
  for (const post of seed.posts) {
    assert.ok(users.has(post.userId));
    assert.ok(companies.has(post.companyId));
    if (post.requesterId) assert.ok(users.has(post.requesterId));
  }
  for (const item of seed.attention) {
    assert.ok(users.has(item.userId));
    assert.ok(companies.has(item.companyId));
    if (item.postId) assert.ok(posts.has(item.postId));
  }
});

test("queue replies route from request context and resolve DM and comment requests", () => {
  const dm = seed.attention.find((item) => item.kind === "dm");
  const comment = seed.attention.find(
    (item) => item.kind === "comment" && item.postId,
  );
  assert.ok(dm && comment);
  const dmEvent = queueReply(dm, "I can check the build.");
  // A payload cannot redirect a request away from its seeded person/context.
  dmEvent.data.userId = "unrelated_person";
  dmEvent.data.kind = "review";
  dmEvent.data.postId = comment.postId;
  const state = projectSession(
    seed,
    journal(dmEvent, queueReply(comment, "The spacing looks good.")),
  );
  assert.equal(
    state.threads.find((thread) => thread.userId === dm.userId).messages.at(-1)
      .text,
    "I can check the build.",
  );
  assert.equal(
    state.threads.some((thread) => thread.userId === "unrelated_person"),
    false,
  );
  assert.deepEqual(state.comments[comment.postId], [
    { userId: "you", text: "The spacing looks good." },
  ]);
  for (const item of [dm, comment]) {
    const projected = state.attention.find((entry) => entry.id === item.id);
    assert.equal(projected.resolved, true);
    assert.equal(projected.replies.length, 1);
  }
});

test("standalone requests use a conversation and can be reopened without losing a reply", () => {
  const original = seed.attention[0];
  const item = { ...original, id: "standalone_mention", kind: "mention" };
  delete item.postId;
  const fixture = deepFreeze({ ...seed, attention: [item] });
  const state = projectSession(
    fixture,
    journal(
      queueReply(item, "Let's check this together."),
      event("queue.resolve", { itemId: item.id, resolved: false }),
    ),
  );
  assert.equal(state.attention[0].resolved, false);
  assert.equal(
    state.attention[0].replies[0].text,
    "Let's check this together.",
  );
  assert.equal(
    state.threads
      .find((thread) => thread.userId === item.userId)
      .messages.at(-1).text,
    "Let's check this together.",
  );
  assert.deepEqual(Object.keys(state.comments), []);
  const resolved = projectSession(
    fixture,
    journal(event("queue.resolve", { itemId: item.id, resolved: true })),
  );
  assert.equal(resolved.attention[0].resolved, true);
  assert.deepEqual(resolved.attention[0].replies, []);
});

test("reading a thread preserves requests; sending a message resolves only that person's DMs", () => {
  const dm = seed.attention.find((item) => item.kind === "dm");
  const readState = projectSession(
    seed,
    journal(event("message.read", { userId: dm.userId })),
  );
  assert.equal(
    readState.attention.find((item) => item.id === dm.id).resolved,
    false,
  );
  const sent = projectSession(
    seed,
    journal(
      event("message.send", { userId: dm.userId, text: "Review complete." }),
    ),
  );
  for (const item of sent.attention) {
    assert.equal(
      item.resolved,
      item.kind === "dm" && item.userId === dm.userId,
    );
  }
  assert.equal(
    sent.threads.find((thread) => thread.userId === dm.userId).unread,
    false,
  );
});

test("refresh replay preserves deadlines and ignores responses made at or after expiry", () => {
  const post = seed.posts.find((entry) => entry.instant);
  const deadline =
    Date.parse(startedAt) + post.instant.expiresInMinutes * 60_000;
  const valid = event(
    "post.respond",
    { postId: post.id, optionId: post.instant.options[0].id },
    new Date(deadline - 1).toISOString(),
  );
  const closed = event(
    "post.respond",
    { postId: post.id, optionId: post.instant.options[1].id },
    new Date(deadline).toISOString(),
  );
  const session = journal(valid, closed);
  const state = projectSession(seed, session);
  assert.equal(state.deadlines[post.id], deadline);
  assert.equal(state.responses[post.id], post.instant.options[0].id);
  const refreshed = projectSession(seed, {
    ...session,
    updatedAt: "2030-01-01T00:00:00.000Z",
  });
  assert.deepEqual(refreshed, state);
});

test("created work replays once with its creation deadline and accepts later comments and saves", () => {
  const post = {
    ...structuredClone(seed.posts[0]),
    id: "my_private_post",
    userId: "you",
    comments: [],
    commentCount: 0,
  };
  const createdAt = "2026-10-03T12:00:00.000Z";
  const session = journal(
    event("post.create", { post }, createdAt),
    event("post.create", { post }, "2026-10-03T13:00:00.000Z"),
    event("post.comment", { postId: post.id, text: "A follow-up note." }),
    event("post.save", { postId: post.id, saved: true }),
  );
  const state = projectSession(seed, session);
  assert.equal(state.allPosts[0].id, post.id);
  assert.equal(
    state.allPosts.filter((entry) => entry.id === post.id).length,
    1,
  );
  assert.equal(
    state.deadlines[post.id],
    Date.parse(createdAt) + post.instant.expiresInMinutes * 60_000,
  );
  assert.equal(state.comments[post.id][0].text, "A follow-up note.");
  assert.deepEqual(state.saved, [post.id]);
});

test("replaying activity does not mutate the seed or journal and produces the same state", () => {
  const dm = seed.attention.find((item) => item.kind === "dm");
  const session = deepFreeze(
    journal(
      queueReply(dm, "Ready to test."),
      event("post.comment", {
        postId: seed.posts[0].id,
        text: "One more note.",
      }),
      event("post.like", { postId: seed.posts[0].id, liked: true }),
      event("post.like", { postId: seed.posts[0].id, liked: false }),
    ),
  );
  const seedBefore = JSON.stringify(seed),
    journalBefore = JSON.stringify(session);
  const first = projectSession(seed, session),
    second = projectSession(seed, session);
  assert.deepEqual(first, second);
  assert.deepEqual(first.liked, []);
  assert.equal(JSON.stringify(seed), seedBefore);
  assert.equal(JSON.stringify(session), journalBefore);
});

test("schema-valid IDs that match Object properties can hold comments, responses, and deadlines", () => {
  const ids = ["__proto__", "constructor", "toString"];
  const events = ids.flatMap((id) => {
    const post = {
      ...structuredClone(seed.posts[0]),
      id,
      userId: "you",
      comments: [],
      commentCount: 0,
    };
    return [
      event("post.create", { post }),
      event("post.comment", { postId: id, text: `Review for ${id}` }),
      event("post.respond", {
        postId: id,
        optionId: post.instant.options[0].id,
      }),
    ];
  });
  // journal() validates every payload through the real session schema first.
  const state = projectSession(seed, journal(...events));
  const expectedDeadline =
    Date.parse(actionAt) + seed.posts[0].instant.expiresInMinutes * 60_000;
  for (const id of ids) {
    assert.equal(state.comments[id][0].text, `Review for ${id}`);
    assert.equal(state.responses[id], seed.posts[0].instant.options[0].id);
    assert.equal(state.deadlines[id], expectedDeadline);
    assert.ok(Object.hasOwn(state.comments, id));
    assert.ok(Object.hasOwn(state.responses, id));
    assert.ok(Object.hasOwn(state.deadlines, id));
  }
});
