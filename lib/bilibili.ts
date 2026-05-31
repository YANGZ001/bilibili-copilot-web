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
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.url || url
  } catch (error) {
    console.error('Failed to resolve short url:', error)
    return url
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
export async function getSubtitleForVideo(url: string): Promise<SubtitleResult> {
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
      return {
        available: false,
        reason: viewJson.message || '获取视频信息失败',
        text: '',
        title: '未知视频',
      }
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
      return {
        available: false,
        reason: playerJson.message || '获取播放器详情失败',
        text: '',
        title,
      }
    }

    const subtitles = playerJson.data.subtitle?.subtitles as BiliSubtitleInfo[] | undefined
    if (!subtitles || subtitles.length === 0) {
      return {
        available: false,
        reason: '该视频暂无可用字幕。',
        text: '',
        title,
      }
    }

    // Prefer zh-CN, fallback to zh-Hans, then any zh, then first available
    const selected =
      subtitles.find((s: BiliSubtitleInfo) => s.lan === 'zh-CN') ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan === 'zh-Hans') ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan.startsWith('zh')) ||
      subtitles.find((s: BiliSubtitleInfo) => s.lan.startsWith('ai-zh')) ||
      subtitles[0]

    if (!selected || !selected.subtitle_url) {
      return {
        available: false,
        reason: '未找到匹配的中文/可用字幕。',
        text: '',
        title,
      }
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
      return {
        available: false,
        reason: '无法解析字幕文件内容。',
        text: '',
        title,
      }
    }

    // Format subtitle text preserving newlines and timestamps
    const text = body
      .map((item) => `[${formatSeconds(item.from)} - ${formatSeconds(item.to)}] ${item.content}`)
      .join('\n')

    return {
      available: true,
      reason: '',
      text,
      title,
    }
  } catch (error: unknown) {
    console.error('Error fetching Bilibili subtitles:', error)
    const errMessage = error instanceof Error ? error.message : String(error)
    return {
      available: false,
      reason: errMessage || '请求 Bilibili 接口出现异常',
      text: '',
      title: '未知视频',
    }
  }
}
