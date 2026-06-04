# Design: Copy Video Link Button

## Data Model
No new data. The video URL is already in client state as `activeContext.videoUrl` (HomeClient.tsx).

## Core Flow

```
User sees video title banner
        |
        v
Clicks "复制链接" button
        |
        v
navigator.clipboard.writeText(activeContext.videoUrl)
        |
        v
Button label → "已复制" + checkmark icon
        |
   (2 seconds)
        v
Button label → "复制链接" + copy icon (reset)
```

## API Design
None — pure client-side using the browser Clipboard API.

## Frontend State

New state in `HomeClient.tsx`:
```ts
const [copied, setCopied] = useState(false);
```

New handler in `HomeClient.tsx`:
```ts
const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(activeContext!.videoUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch {
    setError('复制失败，请手动复制链接')
  }
}
```

Button renders conditionally on `copied`:
- `false` → copy icon + "复制链接"
- `true`  → checkmark icon + "已复制"

## Storage Rationale
No storage needed.

## Directory Changes
- Modified: `components/HomeClient.tsx` — add state, handler, and button element
