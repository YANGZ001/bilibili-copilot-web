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

    // Save to Upstash Redis cache (TTL: 7 days = 604800 seconds)
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: 604800 })
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
      title: '未知视频',
    }

    // Save failure to Upstash Redis cache (TTL: 12 hours = 43200 seconds) to avoid slamming API
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: 43200 })
        console.log(`[Subtitle Cache] Saved Failure MISS for key: ${cacheKey}`)
      } catch (err) {
        console.error('[Subtitle Cache] Failed to write to Redis:', err)
      }
    }

    return result
  }
}
