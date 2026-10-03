import { z } from "zod";

export const MAX_EVENTS = 2_000;
export const MAX_BATCH_EVENTS = 50;
export const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 4_000;

export class SessionError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "SessionError";
    this.code = code;
    this.status = status;
  }
}

const uuid = z.string().uuid();
const timestamp = z.string().datetime();
const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const caption = z.string().max(MAX_TEXT_LENGTH);
const count = z.number().int().min(0).max(1_000_000_000);
const imageSource = z
  .string()
  .min(1)
  .max(2 * 1024 * 1024)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//")) {
      return !/[\u0000-\u001f\\]/.test(value);
    }
    if (
      /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]+=*$/.test(
        value,
      )
    ) {
      return true;
    }
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Image must be a local path, web URL, or supported raster image data URL.");

const post = z
  .object({
    id: identifier,
    userId: z.literal("you"),
    companyId: identifier.optional(),
    requesterId: identifier.optional(),
    location: z.string().max(160),
    time: z.string().max(40),
    images: z.array(imageSource).min(1).max(10),
    alt: z.string().max(MAX_TEXT_LENGTH),
    caption,
    tags: z.string().max(1_000),
    likes: count,
    commentCount: count,
    comments: z.array(z.object({ userId: identifier, text }).strict()).max(100),
    workType: z.string().min(1).max(64).optional(),
    instant: z
      .object({
        kind: z.string().min(1).max(40),
        title: z.string().min(1).max(240),
        expiresInMinutes: z.number().positive().max(10_080),
        options: z
          .array(
            z
              .object({
                id: identifier,
                label: z.string().min(1).max(120),
                count,
              })
              .strict(),
          )
          .min(2)
          .max(6),
      })
      .strict()
      .optional(),
  })
  .strict();

const payloads = {
  "post.like": z.object({ postId: identifier, liked: z.boolean() }).strict(),
  "post.save": z.object({ postId: identifier, saved: z.boolean() }).strict(),
  "person.follow": z
    .object({ userId: identifier, following: z.boolean() })
    .strict(),
  "post.respond": z
    .object({ postId: identifier, optionId: identifier })
    .strict(),
  "post.comment": z.object({ postId: identifier, text }).strict(),
  "message.send": z.object({ userId: identifier, text }).strict(),
  "message.read": z.object({ userId: identifier }).strict(),
  "queue.reply": z
    .object({
      itemId: identifier,
      userId: identifier,
      kind: z.enum(["dm", "comment", "mention", "review"]),
      postId: identifier.optional(),
      text,
    })
    .strict(),
  "queue.resolve": z
    .object({ itemId: identifier, resolved: z.boolean() })
    .strict(),
  "post.create": z.object({ post }).strict(),
};

export const activitySchema = z.discriminatedUnion(
  "type",
  Object.entries(payloads).map(([type, data]) =>
    z.object({ id: uuid, type: z.literal(type), at: timestamp, data }).strict(),
  ),
);
export const sessionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: uuid,
    userId: z.literal("you"),
    createdAt: timestamp,
    updatedAt: timestamp,
    activity: z.array(activitySchema).max(MAX_EVENTS),
  })
  .strict();

function validate(schema, value, message) {
  const result = schema.safeParse(value);
  if (!result.success) throw new SessionError("invalid_activity", message);
  return result.data;
}

export function isSessionId(value) {
  return uuid.safeParse(value).success;
}

export function parseActivityBatch(value) {
  return validate(
    z
      .object({ events: z.array(activitySchema).min(1).max(MAX_BATCH_EVENTS) })
      .strict(),
    value,
    "Send 1–50 valid activity events with unique UUIDs, ISO timestamps, and supported data.",
  ).events;
}

export function parseSessionDocument(value) {
  const document = validate(
    sessionSchema,
    value,
    "This session document is invalid.",
  );
  if (
    new Set(document.activity.map((event) => event.id)).size !==
    document.activity.length
  ) {
    throw new SessionError(
      "invalid_session",
      "This session contains duplicate event IDs.",
    );
  }
  if (Date.parse(document.updatedAt) < Date.parse(document.createdAt)) {
    throw new SessionError(
      "invalid_session",
      "The session timestamps are invalid.",
    );
  }
  if (
    new TextEncoder().encode(JSON.stringify(document)).byteLength >
    MAX_DOCUMENT_BYTES
  ) {
    throw new SessionError(
      "session_full",
      "This session has reached its storage limit. Export it before starting a new session.",
      413,
    );
  }
  return document;
}

export function createSessionDocument(id, now = new Date().toISOString()) {
  return parseSessionDocument({
    schemaVersion: 1,
    id,
    userId: "you",
    createdAt: now,
    updatedAt: now,
    activity: [],
  });
}

/** Appends in journal order. Re-sending the same event is safe. */
export function appendActivity(
  document,
  events,
  now = new Date().toISOString(),
) {
  const session = parseSessionDocument(document);
  const validated = parseActivityBatch({ events });
  const existing = new Map(session.activity.map((event) => [event.id, event]));
  const added = [];
  for (const event of validated) {
    const previous = existing.get(event.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) {
        throw new SessionError(
          "event_conflict",
          "An existing event ID cannot be used for different activity.",
          409,
        );
      }
      continue;
    }
    added.push(event);
    existing.set(event.id, event);
  }
  if (!added.length) return session;
  if (session.activity.length + added.length > MAX_EVENTS) {
    throw new SessionError(
      "session_full",
      "This session has reached 2,000 events. Export it before starting a new session.",
      413,
    );
  }
  return parseSessionDocument({
    ...session,
    updatedAt:
      Date.parse(now) < Date.parse(session.updatedAt) ? session.updatedAt : now,
    activity: [...session.activity, ...added],
  });
}
