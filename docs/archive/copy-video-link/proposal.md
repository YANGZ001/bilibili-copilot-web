# Proposal: Copy Video Link Button

## Background
The video title banner shows the video title and an "Open in Bilibili" link. There is no way to copy the video URL to the clipboard without manually selecting text from the browser address bar or the link itself. Users who want to share a link need an extra step.

## Goals
- Add a "复制链接" (Copy Link) button in the video title banner that copies the current video URL to the clipboard with one click.
- Show a brief "已复制" (Copied) confirmation for ~2 seconds so the user knows the action succeeded.

## Non-Goals
- Copying any other content (summary, transcript, timestamps).
- Constructing a canonical URL — copy exactly what the user originally typed.
- Any backend changes.

## Design Principles
- Simplicity first: pure client-side, no new dependencies.
- Match existing button style exactly — no new CSS classes.

## Constraints
- Must work in all modern browsers (Clipboard API is supported everywhere relevant).
- No layout shift — button must fit in the existing flex row.
