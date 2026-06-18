// Source detection for the supported transcription platforms.
// Mirrors detectSource() in audio-trainscript-service/src/services/transcribePipeline.ts —
// the downstream service auto-detects from the URL, so these patterns must stay in sync.

export type Source = 'bilibili' | 'snipd' | 'xiaoyuzhou'

// Returns the source for a URL, or null if it isn't one we support.
export function detectSource(url: string): Source | null {
  if (/bilibili\.com|b23\.tv/i.test(url)) return 'bilibili'
  if (/share\.snipd\.com\/episode\//i.test(url)) return 'snipd'
  if (/xiaoyuzhoufm\.com\/episode\//i.test(url)) return 'xiaoyuzhou'
  return null
}

// Extracts a stable per-source id used for cache keys and session video_id.
// Returns '' when no id can be parsed.
export function extractSourceId(url: string, source: Source): string {
  let match: RegExpExecArray | null = null
  if (source === 'bilibili') {
    match = /\/video\/(BV[a-zA-Z0-9]+)/i.exec(url)
  } else if (source === 'snipd') {
    match = /episode\/([0-9a-f-]{36})/i.exec(url)
  } else if (source === 'xiaoyuzhou') {
    match = /episode\/([0-9a-f]{24})/i.exec(url)
  }
  return match ? match[1] : ''
}

// Human-readable label for a source (used for the podcast fallback title).
export function sourceLabel(source: Source): string {
  if (source === 'bilibili') return 'B站'
  if (source === 'snipd') return 'Snipd'
  return '小宇宙'
}
