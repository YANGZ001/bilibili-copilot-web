# Context: Copy Video Link Button

## 2026-06-01
- Feature requested by user: add a button to copy the video URL to clipboard.
- Design decided: pure client-side, no backend. Uses `navigator.clipboard.writeText`.
- Video URL available at `activeContext.videoUrl` in `HomeClient.tsx` — no new data needed.
- Button placement: in the existing flex row in the video title banner, after "在 B站 播放".
- Style: match existing button classes (text-xs, text-slate-400, hover:text-slate-200, etc.).

## 2026-06-04
- Code review found `navigator.clipboard.writeText` was unhandled — rejects silently on permission denial, non-secure context, or older browsers with no `clipboard` API.
- Added `try/catch` to `handleCopyLink`: on failure, calls `window.prompt()` with the URL pre-filled so the user can copy manually.
- Discovered `setError()` would be invisible while video content is showing (error section is inside the hidden form). Switched to inline `window.prompt()` approach instead.
- Fixed `新对话` button: `router.push('/')` did not update the URL when accessed via hostname (Next.js App Router quirk). Replaced with `window.location.href = '/'` for reliable full-page navigation.
- Fixed b23.tv short links failing with "Cannot extract BVID from URL": the summarize route was passing the raw short URL to `callTranscribeService`. Fixed by calling `resolveShortUrl(url)` once at the top of the POST handler and using `resolvedUrl` everywhere downstream.
- Fixed garbled video URL (`https://www.bilibili.com/video/https://b23.tv/xxx`) when loading via short link: `extractBvid(submittedUrl)` returned `''` for short links, so the session stored the raw URL as `video_id`. Fixed by extracting `bvid` from the server-side-resolved URL and passing it back in the `METADATA_END` metadata payload. `HomeClient` now reads `resolvedVideoId` from metadata for session creation.
- Short link test spec corrected: `useSession` always reconstructs `video_url` from `video_id` as the canonical BV URL; original short link is not preserved after session is created.
