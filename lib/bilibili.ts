import { Redis } from '@upstash/redis'

// Initialize Upstash Redis client if env variables are provided
let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
} else {
  console.warn('Upstash Redis environment variables are missing. Subtitle caching is disabled.')
}

export interface ResolvedVideo {
  aid: number
  bvid: string
  cid: number
  page: number
  title: string
  url: string
}

export interface SubtitleItem {
  from: number
  to: number
  content: string
}

export interface SubtitleResult {
  available: boolean
  reason: string
  text: string
  title: string
}

// Format seconds into HH:MM:SS
export function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.floor(seconds % 60)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

// Extract BV id from a Bilibili URL
export function extractBvidFromUrl(url: string): string | null {
  const match = /\/video\/(BV[a-zA-Z0-9]+)/.exec(url)
  return match ? match[1] : null
}

// Extract page number from URL query params (defaults to 1)
export function extractPageFromUrl(url: string): number {
  try {
    const parsedUrl = new URL(url)
    const page = parsedUrl.searchParams.get('p')
    const parsed = page ? parseInt(page, 10) : 1
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  } catch {
    return 1
  }
}

// Follow short URLs (like b23.tv/xxxx) to get the actual video URL
export async function resolveShortUrl(url: string): Promise<string> {
  if (!url.includes('b23.tv')) {
    return url
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    Referer: 'https://www.bilibili.com',
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    // Strategy 1: Manual redirect to get the location header immediately (fastest & safest)
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (location) {
        // If the location header is relative, resolve it against the original URL
        return new URL(location, url).toString()
      }
    }

    return res.url || url
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('Failed to resolve short url with manual redirect, trying fallback HEAD:', error)

    // Fallback strategy 2: HEAD request with follow redirect and timeout
    const fallbackController = new AbortController()
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), 5000)
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: fallbackController.signal,
      })
      clearTimeout(fallbackTimeout)
      return res.url || url
    } catch (fallbackError) {
      clearTimeout(fallbackTimeout)
      console.error('All short url resolution strategies failed:', fallbackError)
      return url
    }
  }
}

interface BiliPage {
  cid: number
  page: number
  part: string
}

interface BiliSubtitleInfo {
  lan: string
  subtitle_url: string
}

// Fetch video details and subtitle list
export async function getSubtitleForVideo(url: string, bypassCache = false): Promise<SubtitleResult> {
  const resolvedUrl = await resolveShortUrl(url)
  const bvid = extractBvidFromUrl(resolvedUrl)
  if (!bvid) {
    return {
      available: false,
      reason: '无法识别的 B站 视频链接，请确保链接包含 /video/BV...',
      text: '',
      title: '未知视频',
    }
  }

  const page = extractPageFromUrl(resolvedUrl)
  const cacheKey = `bilibili:subtitle:${bvid}:${page}`

  // Check Upstash Redis cache first (skip if bypassCache is true)
  if (redis && !bypassCache) {
    try {
      const cached = await redis.get<SubtitleResult>(cacheKey)
      if (cached) {
        console.log(`[Subtitle Cache] HIT for key: ${cacheKey}`)
        return cached
      }
      console.log(`[Subtitle Cache] MISS for key: ${cacheKey}`)
    } catch (err) {
      console.error('[Subtitle Cache] Failed to read from Redis:', err)
    }
  } else if (redis && bypassCache) {
    console.log(`[Subtitle Cache] Bypassing cache read for key: ${cacheKey} (forced refresh)`)
  }

  const sessdata = process.env.BILIBILI_SESSION_TOKEN || ''

  const headers: HeadersInit = {
    Accept: 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    Referer: 'https://www.bilibili.com',
  }

  if (sessdata) {
    headers['Cookie'] = `SESSDATA=${sessdata}`
  }

  let videoTitle = '未知视频'

  try {
    // 1. Fetch video basic info
    const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    const viewRes = await fetch(viewUrl, { headers })
    if (!viewRes.ok) {
      throw new Error(`Failed to fetch video view: ${viewRes.statusText}`)
    }
    const viewJson = await viewRes.json()
    if (viewJson.code !== 0 || !viewJson.data) {
      throw new Error(viewJson.message || '获取视频信息失败')
    }

    const { aid, pages, title } = viewJson.data
    videoTitle = title as string
    let cid = viewJson.data.cid

    // Find cid for the specific page if multi-part
    if (pages && pages.length > 0) {
      const pageInfo = pages.find((p: BiliPage) => p.page === page)
      if (pageInfo) {
        cid = pageInfo.cid
      }
    }

    // 2. Fetch subtitle list from player API v2
    const playerUrl = `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`
    const playerRes = await fetch(playerUrl, { headers })
    if (!playerRes.ok) {
      throw new Error(`Failed to fetch player details: ${playerRes.statusText}`)
    }
    const playerJson = await playerRes.json()
    if (playerJson.code !== 0 || !playerJson.data) {
      throw new Error(playerJson.message || '获取播放器详情失败')
    }

    const subtitles = playerJson.data.subtitle?.subtitles as BiliSubtitleInfo[] | undefined
    if (!subtitles || subtitles.length === 0) {
      throw new Error('该视频暂无可用字幕。')
    }

    // Prefer zh-CN, fallback to zh-Hans, then any zh, then first available
    const selected =
      subtitles.find((s: BiliSubtitleInfo) => s.lan === 'zh-CN') ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan === 'zh-Hans') ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan.startsWith('zh')) ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan.startsWith('ai-zh')) ||
      subtitles[0]

    if (!selected || !selected.subtitle_url) {
      throw new Error('未找到匹配的中文/可用字幕。')
    }

    // 3. Download the actual subtitle file
    const subtitleUrl = selected.subtitle_url.startsWith('//')
      ? `https:${selected.subtitle_url}`
      : selected.subtitle_url

    const subtitleRes = await fetch(subtitleUrl)
    if (!subtitleRes.ok) {
      throw new Error(`Failed to download subtitle file: ${subtitleRes.statusText}`)
    }
    const subtitleJson = await subtitleRes.json()
    const body = subtitleJson.body as SubtitleItem[]
    if (!body || !Array.isArray(body)) {
      throw new Error('无法解析字幕文件内容。')
    }

    // Format subtitle text preserving newlines and timestamps
    const text = body
      .map((item) => `[${formatSeconds(item.from)} - ${formatSeconds(item.to)}] ${item.content}`)
      .join('\n')

    const result: SubtitleResult = {
      available: true,
      reason: '',
      text,
      title,
    }

    // Save to Upstash Redis cache; TTL controlled by SUBTITLE_REDIS_CACHE_TTL_SECONDS (default 7 days)
    const subtitleCacheTtl = parseInt(process.env.SUBTITLE_REDIS_CACHE_TTL_SECONDS ?? '604800', 10)
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: subtitleCacheTtl })
        console.log(`[Subtitle Cache] Saved HIT for key: ${cacheKey}`)
      } catch (err) {
        console.error('[Subtitle Cache] Failed to write to Redis:', err)
      }
    }

    return result
  } catch (error: unknown) {
    console.error('Error fetching Bilibili subtitles:', error)
    const errMessage = error instanceof Error ? error.message : String(error)
    const result: SubtitleResult = {
      available: false,
      reason: `字幕获取失败: ${errMessage}`,
      text: '',
      title: videoTitle,
    }

    // Save failure to Upstash Redis cache (TTL: 30 minutes = 1800 seconds) to avoid slamming API
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: 1800 })
        console.log(`[Subtitle Cache] Saved Failure MISS for key: ${cacheKey}`)
      } catch (err) {
        console.error('[Subtitle Cache] Failed to write to Redis:', err)
      }
    }

    return result
  }
}

// Wraps callTranscribeService with a Redis cache layer (key: bilibili:asr:{bvid}).
// On cache hit returns instantly; on miss calls the service and stores the result.
export async function getCachedTranscript(
  bvid: string,
  videoUrl: string,
  onProgress: (step: string, progress?: number) => void,
  signal?: AbortSignal,
  bypassCache = false,
  model?: string,
): Promise<string> {
  const cacheKey = `bilibili:asr:${bvid}:${model || 'default'}`
  const cacheTtl = parseInt(process.env.SUBTITLE_REDIS_CACHE_TTL_SECONDS ?? '604800', 10)

  if (redis && !bypassCache) {
    try {
      const cached = await redis.get<string>(cacheKey)
      if (cached) {
        console.log(`[ASR Cache] HIT for key: ${cacheKey}`)
        return cached
      }
      console.log(`[ASR Cache] MISS for key: ${cacheKey}`)
    } catch (err) {
      console.error('[ASR Cache] Failed to read from Redis:', err)
    }
  } else if (redis && bypassCache) {
    console.log(`[ASR Cache] Bypassing cache read for key: ${cacheKey} (forced refresh)`)
  }

  const text = await callTranscribeService(videoUrl, onProgress, signal, model)

  if (text && redis) {
    try {
      await redis.set(cacheKey, text, { ex: cacheTtl })
      console.log(`[ASR Cache] Saved for key: ${cacheKey}`)
    } catch (err) {
      console.error('[ASR Cache] Failed to write to Redis:', err)
    }
  }

  return text
}

// Calls the audio-trainscript-service SSE endpoint and returns the formatted subtitle text.
// onProgress is called for each downloading/uploading/transcribing event.
// signal can be used to abort (e.g. 10-minute timeout).
export async function callTranscribeService(
  videoUrl: string,
  onProgress: (step: string, progress?: number) => void,
  signal?: AbortSignal,
  model?: string,
): Promise<string> {
  const serviceUrl = process.env.AUDIO_TRANSCRIBE_SERVICE_URL
  if (!serviceUrl) throw new Error('AUDIO_TRANSCRIBE_SERVICE_URL is not configured')

  const endpoint = model
    ? `${serviceUrl}/api/transcribe?model=${encodeURIComponent(model)}`
    : `${serviceUrl}/api/transcribe`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'bilibili', url: videoUrl }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Transcribe service returned ${response.status} ${response.statusText}`)
  }
  if (!response.body) throw new Error('No response body from transcribe service')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let pendingEvent = ''
  let pendingData = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('event:')) {
        pendingEvent = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        pendingData = line.slice(5).trim()
      } else if (line === '') {
        if (pendingEvent && pendingData) {
          const data = JSON.parse(pendingData)
          if (pendingEvent === 'downloading') {
            onProgress('downloading', typeof data.progress === 'number' ? data.progress : undefined)
          } else if (pendingEvent === 'uploading') {
            onProgress('uploading')
          } else if (pendingEvent === 'transcribing') {
            onProgress('transcribing')
          } else if (pendingEvent === 'done') {
            if (typeof data?.text !== 'string') throw new Error('Invalid done payload from transcribe service')
            return data.text
          } else if (pendingEvent === 'error') {
            throw new Error(data.error || 'Transcription service error')
          }
        }
        pendingEvent = ''
        pendingData = ''
      }
    }
  }

  throw new Error('Transcribe service stream ended without a done event')
}
