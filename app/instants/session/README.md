# Private session files

During local development, Instants keeps one private activity journal for each browser profile:

```text
session/
  README.md
  <random-session-uuid>/
    session.json
```

Actual session directories are ignored by Git and excluded from Next.js deployment traces. They are created at runtime, never packaged with the app. Do not commit or share them: they can contain comments, messages, and uploaded work.

```json
{
  "schemaVersion": 1,
  "id": "a5e21fcb-3a50-43f8-b7b0-c5d93c878334",
  "userId": "you",
  "createdAt": "2026-10-03T10:00:00.000Z",
  "updatedAt": "2026-10-03T10:01:00.000Z",
  "activity": [
    {
      "id": "e93b2796-34fc-48ad-b379-f304251d1a44",
      "type": "queue.reply",
      "at": "2026-10-03T10:01:00.000Z",
      "data": {
        "itemId": "a1",
        "userId": "ella",
        "kind": "dm",
        "text": "Tested the mobile flow. Ready for review."
      }
    }
  ]
}
```

The document is an append-only journal. The UI replays events over the mock seed data; seed files stay unchanged. Repeating an event ID with the same contents does not duplicate the action. Reusing an ID for different contents is rejected.

The API selects the file through a random, HttpOnly `instants-session` cookie. Clients cannot choose a session path. This is private browser-scoped demo storage, not an authenticated team identity or an access-control system for a shared server. People using the same browser profile share its session. Anyone with filesystem access can read local files.

Writes validate the document, serialize requests within the local Node process, and replace the JSON file atomically. This local adapter is intended for one app process. It does not coordinate writes across multiple server processes. A failed write preserves the previous file.

On Vercel, the API explicitly selects browser storage. It never writes durable-looking files under `/tmp`. The browser adapter and JSON export are described in [the engine documentation](../docs/engine.md).

Limits keep this deliberately small: 2,000 events per session, 50 events per request, 4,000 characters per message, 3 MiB per request, and 8 MiB per local document. Browser storage can reach its own quota earlier. Full sessions produce an error; old activity is never silently removed.

For a new empty local session, use a fresh browser profile or clear this app's site data. Keep an export before clearing browser data or deleting a local session folder. Removing an active folder starts a fresh session on the next app load.
