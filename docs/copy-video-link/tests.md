# Tests: Copy Video Link Button

## Manual Test Scenarios — all passed 2026-06-04

### Golden Path
1. Open the app, paste a Bilibili video URL, click "一键课代表"
2. Wait for the video title banner to appear
3. Click "复制链接"
4. Verify: button label changes to "已复制" immediately
5. Paste into a text field — URL matches the original input exactly
6. Wait ~2 seconds — verify: button resets to "复制链接"

### Short Link Input
1. Input a `b23.tv` short link
2. Click "复制链接"
3. Verify: the copied text is the original short link (not a resolved URL)

### Button Visibility
1. Open the app with no video loaded — verify: "复制链接" button is NOT visible
2. Load a video — verify: button appears alongside "在 B站 播放"

### Repeated Click
1. Click "复制链接", then immediately click again before the 2-second reset
2. Verify: button stays as "已复制" and timer resets (or clips correctly — no crash)

## Automated Tests
No automated tests required for this change — it is a pure UI interaction with the browser Clipboard API, which cannot be meaningfully unit-tested without jsdom mocking that adds no real confidence.

## Regression Checks
- "在 B站 播放" link still opens video in new tab
- "重新生成" and "新对话" buttons still function normally
- Layout does not overflow on mobile (small screen) with the extra button
