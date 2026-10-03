import { NextRequest, NextResponse } from "next/server";
import { createSessionStore } from "@/engine/session-store.mjs";
import { hasSameOrigin } from "@/engine/http.mjs";
import {
  isSessionId,
  MAX_REQUEST_BYTES,
  parseActivityBatch,
  SessionError,
} from "@/engine/schema.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "instants-session";
const store = createSessionStore();
const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  if (error instanceof SessionError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status, headers },
    );
  }
  // Keep disk paths and implementation details out of API responses.
  return NextResponse.json(
    {
      error: "storage_unavailable",
      message: "Activity could not be saved. Please try again.",
    },
    { status: 503, headers },
  );
}

async function readBody(request: NextRequest) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_REQUEST_BYTES) {
    throw new SessionError(
      "request_too_large",
      "Activity requests must be smaller than 3 MiB.",
      413,
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    throw new SessionError(
      "invalid_content_type",
      "Send activity as application/json.",
      415,
    );
  }
  const reader = request.body?.getReader();
  if (!reader)
    throw new SessionError("invalid_activity", "Activity is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new SessionError(
        "request_too_large",
        "Activity requests must be smaller than 3 MiB.",
        413,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SessionError(
      "invalid_json",
      "The activity request is not valid JSON.",
    );
  }
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json({ mode: "browser", session: null }, { headers });
  }
  try {
    const id = request.cookies.get(COOKIE)?.value;
    const existing = id && isSessionId(id) ? await store.loadSession(id) : null;
    const session = existing ?? (await store.createSession());
    const response = NextResponse.json({ mode: "file", session }, { headers });
    if (!existing) {
      response.cookies.set(COOKIE, session.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!hasSameOrigin(request.url, origin, request.headers.get("host"))) {
    return NextResponse.json(
      {
        error: "invalid_origin",
        message: "Activity can only be saved from this app.",
      },
      { status: 403, headers },
    );
  }
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error: "browser_storage",
        message: "This deployment stores private activity in your browser.",
      },
      { status: 501, headers },
    );
  }
  try {
    const id = request.cookies.get(COOKIE)?.value;
    if (!id || !isSessionId(id)) {
      throw new SessionError(
        "session_missing",
        "Start a session before saving activity.",
        401,
      );
    }
    const events = parseActivityBatch(await readBody(request));
    const session = await store.appendSession(id, events);
    return NextResponse.json({ mode: "file", session }, { headers });
  } catch (error) {
    return failure(error);
  }
}
