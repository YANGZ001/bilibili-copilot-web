# Context: Copy Video Link Button

## 2026-06-01
- Feature requested by user: add a button to copy the video URL to clipboard.
- Design decided: pure client-side, no backend. Uses `navigator.clipboard.writeText`.
- Video URL available at `activeContext.videoUrl` in `HomeClient.tsx` — no new data needed.
- Button placement: in the existing flex row in the video title banner, after "在 B站 播放".
- Style: match existing button classes (text-xs, text-slate-400, hover:text-slate-200, etc.).

## 2026-06-04
- Code review found `navigator.clipboard.writeText` was unhandled — rejects silently on permission denial, non-secure context, or older browsers with no `clipboard` API.
- Added `try/catch` to `handleCopyLink`: on failure, surfaces the existing `setError` state with message "复制失败，请手动复制链接".
- Build verified via `docker compose up --build` — TypeScript clean, container started successfully.
- All acceptance criteria met and manual tests passed.
- Short link test spec corrected: `useSession` always reconstructs `video_url` from `video_id` as the canonical BV URL; original short link is not preserved after session is created.
