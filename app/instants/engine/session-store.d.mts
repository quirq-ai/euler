import type { Activity, SessionDocument } from "./types";

export function createSessionStore(options?: { directory?: string }): {
  createSession(): Promise<SessionDocument>;
  loadSession(id: string): Promise<SessionDocument | null>;
  appendSession(id: string, events: Activity[]): Promise<SessionDocument>;
};
