# Retry / Regenerate Summary — Proposal

## Background

AI-generated summaries are occasionally inaccurate or incomplete. Currently the only recovery path is "新对话" + re-paste the video URL, which creates a new session and discards the old one. This adds friction for a very common need: just try again.

## Goals

- Add a one-click "重新生成" button that re-runs summarization within the same session
- Stream the new summary in real-time, identical UX to the initial generation
- Replace the stored summary and clear stale follow-up chat messages after completion
- Preserve the session ID and URL so the user stays in place

## Non-Goals

- Changing the template/mode on retry (start a new conversation for that)
- Keeping follow-up chat messages after a retry (they're based on the old summary)
- Bypassing subtitle cache on retry (the issue is AI quality, not stale subtitles)
- Version history or rollback to a previous summary

## Design Principles

- **In-place**: same session ID, same URL — no navigation
- **Minimal friction**: one click, no confirmation dialog
- **Safe on error**: restore the previous summary if the retry fails

## Constraints

- Personal-use app; no multi-user concerns
- Must reuse existing `/api/summarize` streaming endpoint unchanged
