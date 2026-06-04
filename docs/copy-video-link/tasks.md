# Tasks: Copy Video Link Button

## Phase 1 — Implementation

- [x] Add `copied` useState to `HomeClient.tsx`
- [x] Add `handleCopyLink` async handler to `HomeClient.tsx`
- [x] Insert "复制链接" button in the video title banner flex row (after "在 B站 播放" link)

## Acceptance Criteria

- [x] After loading a video, a "复制链接" button appears in the title banner
- [x] Clicking the button copies the exact video URL that was input
- [x] The button label changes to "已复制" for ~2 seconds, then resets
- [x] No layout shift or style inconsistency with existing buttons
