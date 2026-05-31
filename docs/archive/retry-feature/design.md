# Retry / Regenerate Summary — Design

## Data Model

No schema changes. The existing `messages` table already holds all session messages. Retry replaces them in-place.

## Core Flow

```
User clicks "重新生成"
  → HomeClient.handleRetry()
  → POST /api/summarize  { url: activeContext.videoUrl, templateId: activeContext.conversationType }
  → stream new summary into left panel
  → PUT /api/sessions/[id]/messages  { messages: [system, user, assistant] }
  → DB: DELETE messages WHERE session_id = id; INSERT 3 new messages
  → activeContext.chatMessages = []  (VideoChat renders fresh)
```

On error at any step: previous summary is restored from `oldSummary` saved at the start.

## API Design

### PUT /api/sessions/[id]/messages

Replaces all messages for a session with a new set.

**Request**
```
PUT /api/sessions/:id/messages
Content-Type: application/json

{
  "messages": [
    { "role": "system",    "content": "..." },
    { "role": "user",      "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**
- `200 { ok: true }` — success
- `400 { error }` — missing/empty messages array
- `404 { error }` — session not found
- `410 { error }` — session expired

**Side effect**: calls `updateLastAccessed(id)` to refresh TTL.

## Frontend State

`ActiveContext` gains a `conversationType: string` field, set from:
- Initial generate path: `templateId` state value
- Session restore path: `session.conversation_type` from `useSession`

`handleRetry` is client-side and reuses the same stream-reading loop as `handleSummarize`. The only difference at the end: instead of `POST /api/sessions`, it calls `PUT /api/sessions/[id]/messages`.

## Directory Changes

| File | Change |
|------|--------|
| `lib/db/messages.ts` | Add `replaceMessages(session_id, messages)` |
| `app/api/sessions/[id]/messages/route.ts` | Add `PUT` handler |
| `components/HomeClient.tsx` | Add `conversationType` to `ActiveContext`; add `handleRetry`; add retry button |
