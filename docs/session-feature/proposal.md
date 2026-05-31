# Session Feature — Proposal

## Background

The app is currently stateless: refreshing the page or closing the browser loses all conversation history. Users cannot revisit previous summaries or continue asking follow-up questions about a video.

## Goals

1. Bind each conversation to a unique Session ID (UUID), persisted on the server
2. Expose the session ID in the URL so users can return to any past conversation via a saved or shared link
3. Support "New Conversation" while keeping existing sessions independently accessible
4. Provide a device-scoped history list using `device_id` within the same browser

## Non-Goals (out of scope)

- User accounts / authentication
- Cross-device history sync
- Conversation search
- Session sharing permissions (anyone with the UUID can access — by design)

## Design Principles

- **Simplicity first**: Personal-use product; avoid unnecessary complexity
- **Data-driven UI**: Page state is entirely derived from session data; new and restored sessions share the same rendering path
- **Zero-dependency deployment**: Use SQLite — no extra service containers

## Constraints

- Session TTL: 14 days from last access
- Concurrency: Personal use only; no concurrent-access handling needed
- Deploy target: Docker on Ubuntu, accessed via Tailscale private network
- Storage: SQLite, `.db` file mounted via Docker volume
