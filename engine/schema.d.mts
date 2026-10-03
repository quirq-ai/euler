import type { Activity, SessionDocument } from "./types";

export const MAX_EVENTS: 2000;
export const MAX_BATCH_EVENTS: 50;
export const MAX_REQUEST_BYTES: number;
export const MAX_DOCUMENT_BYTES: number;
export const MAX_TEXT_LENGTH: 4000;

export class SessionError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status?: number);
}

export function isSessionId(value: unknown): value is string;
export function parseActivityBatch(value: unknown): Activity[];
export function parseSessionDocument(value: unknown): SessionDocument;
export function createSessionDocument(
  id: string,
  now?: string,
): SessionDocument;
export function appendActivity(
  document: SessionDocument,
  events: Activity[],
  now?: string,
): SessionDocument;
