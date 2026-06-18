import { NextRequest } from 'next/server'
import { getSubtitleForVideo, getCachedTranscript, resolveShortUrl } from '@/lib/bilibili'
import { detectSource, extractSourceId, sourceLabel } from '@/lib/source'
import { findTemplate, type PromptTemplate } from '@/lib/prompts'
import { getLLMConfig } from '@/lib/llm'
import { readSSEChunks } from '@/lib/streamSSE'

export const runtime = 'nodejs'

// Sends the DeepSeek streaming response into a ReadableStream controller.
// Emits the metadata preamble first, then pipes the AI content chunks.
async function pipeDeepSeek(
  controller: ReadableStreamDefaultController<Uint8Array>,
  {
    url,
    template,
    subtitleText,
    videoTitle,
    videoId,
  }: { url: string; template: PromptTemplate; subtitleText: string; videoTitle: string; videoId: string },
): Promise<void> {
  const enc = new TextEncoder()
  const write = (s: string) => controller.enqueue(enc.encode(s))

  const { apiKey, chatEndpoint, model } = getLLMConfig()
  if (!apiKey) {
    write(`ERROR:${JSON.stringify({ error: '服务器未配置 DEEPSEEK_API_KEY，请检查环境变量。' })}\n`)
    controller.close()
    return
  }

  const systemPrompt = [
    '你是一个严谨的音视频字幕分析助手。回答要清晰、具体、可复查。',
    '请严格使用 Markdown 输出。',
    '时间戳只能使用 [MM:SS]、[HH:MM:SS] 或 [MM:SS-MM:SS] 形式。',
    '时间戳必须对应字幕中真实出现的内容，不要编造不存在的时间点。',
  ].join('\n')

  const userPrompt = `${template.instruction}

音视频标题：${videoTitle}
音视频地址：${url}

字幕如下：

${subtitleText}`

  let aiResponse: Response
  try {
    aiResponse = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        stream: true,
      }),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    write(`ERROR:${JSON.stringify({ error: `DeepSeek 连接失败: ${msg}` })}\n`)
    controller.close()
    return
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => aiResponse.statusText)
    write(`ERROR:${JSON.stringify({ error: `DeepSeek API 请求失败: ${aiResponse.status} - ${errText}` })}\n`)
    controller.close()
    return
  }

  if (!aiResponse.body) {
    write(`ERROR:${JSON.stringify({ error: 'DeepSeek 未返回响应体' })}\n`)
    controller.close()
    return
  }

  // Emit metadata preamble (client switches to summary mode after this)
  write(JSON.stringify({ videoTitle, subtitleText, videoId, videoUrl: url }) + '\n===METADATA_END===\n')

  try {
    for await (const chunk of readSSEChunks(aiResponse.body)) {
      write(chunk)
    }
  } catch (err) {
    controller.error(err)
  } finally {
    controller.close()
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, templateId, bypassCache } = await req.json()

    if (!url) {
      return Response.json({ error: '请提供音视频链接。' }, { status: 400 })
    }

    const resolvedUrl = await resolveShortUrl(url)
    const source = detectSource(resolvedUrl)
    if (!source) {
      return Response.json(
        { error: '不支持的链接，请使用 Bilibili、小宇宙 或 Snipd 的链接。' },
        { status: 400 },
      )
    }
    const sourceId = extractSourceId(resolvedUrl, source)
    const template = findTemplate(templateId || 'outline')
    const serviceUrl = process.env.AUDIO_TRANSCRIBE_SERVICE_URL

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        const write = (s: string) => controller.enqueue(enc.encode(s))

        let subtitleText = ''
        let videoTitle = source === 'bilibili' ? sourceId : `${sourceLabel(source)} 单集 · ${sourceId || resolvedUrl}`

        if (serviceUrl) {
          // Primary path: audio-transcript-service
          let asrSucceeded = false
          let asrError = ''
          try {
            const ac = new AbortController()
            const timer = setTimeout(() => ac.abort(), 10 * 60 * 1000)
            try {
              const asrResult = await getCachedTranscript(
                source,
                sourceId,
                resolvedUrl,
                (step, progress) => {
                  write(`PROGRESS:${JSON.stringify({ step, progress })}\n`)
                },
                ac.signal,
                bypassCache,
              )
              subtitleText = asrResult.text
              // Podcasts have no title API; use the title the service resolved.
              // Bilibili keeps its dedicated title fetch below (works on cache hits too).
              if (source !== 'bilibili' && asrResult.title) videoTitle = asrResult.title
              asrSucceeded = true
            } finally {
              clearTimeout(timer)
            }
          } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
              // Timeout is unambiguous — surface it immediately, don't try Bilibili
              write(`ERROR:${JSON.stringify({ error: '转录超时（已超过 10 分钟），请重试或选择更短的音视频。' })}\n`)
              controller.close()
              return
            }
            // Other ASR error: record it. Bilibili can fall back to subtitles; podcasts cannot.
            asrError = err instanceof Error ? err.message : String(err)
            console.error('[Transcript] ASR service failed:', err)
          }

          if (asrSucceeded) {
            // Bilibili exposes a title API; the transcript service doesn't return one.
            // Podcasts keep the generic fallback title set above.
            if (source === 'bilibili') {
              const sessdata = process.env.BILIBILI_SESSION_TOKEN || ''
              const titleHeaders: HeadersInit = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                Referer: 'https://www.bilibili.com',
              }
              if (sessdata) titleHeaders['Cookie'] = `SESSDATA=${sessdata}`
              try {
                const titleAc = new AbortController()
                const titleTimer = setTimeout(() => titleAc.abort(), 5000)
                try {
                  const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${sourceId}`, {
                    headers: titleHeaders,
                    signal: titleAc.signal,
                  })
                  if (viewRes.ok) {
                    const viewJson = await viewRes.json()
                    if (viewJson.code === 0 && viewJson.data?.title) {
                      videoTitle = viewJson.data.title as string
                    }
                  }
                } finally {
                  clearTimeout(titleTimer)
                }
              } catch {
                // Non-critical; keep BV ID as fallback title
              }
            }
          } else if (source === 'bilibili') {
            // Tell the client we're switching to the Bilibili subtitle fallback
            write(`PROGRESS:${JSON.stringify({ step: 'fallback' })}\n`)
            const subtitleResult = await getSubtitleForVideo(resolvedUrl, bypassCache)
            if (!subtitleResult.available) {
              const msg = asrError
                ? `转录失败: ${asrError}。字幕回退也失败: ${subtitleResult.reason}`
                : subtitleResult.reason
              write(`ERROR:${JSON.stringify({ error: msg })}\n`)
              controller.close()
              return
            }
            subtitleText = subtitleResult.text
            videoTitle = subtitleResult.title
          } else {
            // Podcasts have no subtitle fallback — surface the ASR error directly.
            write(`ERROR:${JSON.stringify({ error: `转录失败: ${asrError || '未知错误'}` })}\n`)
            controller.close()
            return
          }
        } else if (source === 'bilibili') {
          // No transcription service configured: Bilibili subtitles only
          const subtitleResult = await getSubtitleForVideo(resolvedUrl, bypassCache)
          if (!subtitleResult.available) {
            write(`ERROR:${JSON.stringify({ error: subtitleResult.reason })}\n`)
            controller.close()
            return
          }
          subtitleText = subtitleResult.text
          videoTitle = subtitleResult.title
        } else {
          // Podcasts require the transcription service.
          write(`ERROR:${JSON.stringify({ error: '未配置转录服务，无法处理该链接。' })}\n`)
          controller.close()
          return
        }

        await pipeDeepSeek(controller, {
          url: resolvedUrl,
          template,
          subtitleText,
          videoTitle,
          videoId: sourceId,
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('Summarize error:', error)
    const errMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: errMessage || '内部服务器错误' }, { status: 500 })
  }
}
