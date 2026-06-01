import { NextRequest } from 'next/server'
import { getSubtitleForVideo, callTranscribeService } from '@/lib/bilibili'
import { findTemplate, type PromptTemplate } from '@/lib/prompts'

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
  }: { url: string; template: PromptTemplate; subtitleText: string; videoTitle: string },
): Promise<void> {
  const enc = new TextEncoder()
  const write = (s: string) => controller.enqueue(enc.encode(s))

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
  const apiBase =
    process.env.DEEPSEEK_API_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'

  if (!apiKey) {
    write(`ERROR:${JSON.stringify({ error: '服务器未配置 DEEPSEEK_API_KEY，请检查环境变量。' })}\n`)
    controller.close()
    return
  }

  const systemPrompt = [
    '你是一个严谨的视频字幕分析助手。回答要清晰、具体、可复查。',
    '请严格使用 Markdown 输出。',
    '时间戳只能使用 [MM:SS]、[HH:MM:SS] 或 [MM:SS-MM:SS] 形式。',
    '时间戳必须对应字幕中真实出现的内容，不要编造不存在的时间点。',
  ].join('\n')

  const userPrompt = `${template.instruction}

视频标题：${videoTitle}
视频地址：${url}

字幕如下：

${subtitleText}`

  const chatEndpoint = `${apiBase.replace(/\/+$/, '')}/chat/completions`

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
  write(JSON.stringify({ videoTitle, subtitleText }) + '\n===METADATA_END===\n')

  const reader = aiResponse.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim())
            const content = data.choices?.[0]?.delta?.content || ''
            if (content) write(content)
          } catch (e) {
            console.error('SSE JSON error', trimmed, e)
          }
        }
      }
    }

    // Flush remaining buffer
    if (buffer.startsWith('data:') && buffer.trim() !== 'data: [DONE]') {
      try {
        const data = JSON.parse(buffer.slice(5).trim())
        const content = data.choices?.[0]?.delta?.content || ''
        if (content) write(content)
      } catch {}
    }
  } catch (err) {
    controller.error(err)
    return
  } finally {
    controller.close()
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, templateId, bypassCache } = await req.json()

    if (!url) {
      return Response.json({ error: '请提供视频链接。' }, { status: 400 })
    }

    const template = findTemplate(templateId || 'outline')

    // 1. Fetch subtitles and metadata
    const subtitleResult = await getSubtitleForVideo(url, bypassCache)

    if (!subtitleResult.available) {
      const serviceUrl = process.env.AUDIO_TRANSCRIBE_SERVICE_URL
      if (!serviceUrl) {
        return Response.json({ error: subtitleResult.reason }, { status: 400 })
      }

      // ASR fallback: stream PROGRESS: lines while transcribing, then pipe DeepSeek
      const capturedReason = subtitleResult.reason
      const capturedTitle = subtitleResult.title

      const asrStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder()
          const write = (s: string) => controller.enqueue(enc.encode(s))

          let subtitleText = ''
          try {
            const ac = new AbortController()
            const timer = setTimeout(() => ac.abort(), 10 * 60 * 1000)
            try {
              subtitleText = await callTranscribeService(
                url,
                (step, progress) => {
                  write(`PROGRESS:${JSON.stringify({ step, progress })}\n`)
                },
                ac.signal,
              )
            } finally {
              clearTimeout(timer)
            }
          } catch (err: unknown) {
            const isAbort = err instanceof Error && err.name === 'AbortError'
            const isNetwork = err instanceof TypeError
            const msg = isAbort
              ? '转录超时（已超过 10 分钟），请重试或选择更短的视频。'
              : isNetwork
              ? capturedReason
              : err instanceof Error
              ? err.message
              : String(err)
            write(`ERROR:${JSON.stringify({ error: msg })}\n`)
            controller.close()
            return
          }

          await pipeDeepSeek(controller, {
            url,
            template,
            subtitleText,
            videoTitle: capturedTitle,
          })
        },
      })

      return new Response(asrStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // 2. Happy path: subtitles found — pre-fetch DeepSeek so we can return a proper error response
    const { text: subtitleText, title: videoTitle } = subtitleResult

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
    const apiBase =
      process.env.DEEPSEEK_API_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com'
    const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'

    if (!apiKey) {
      return Response.json(
        { error: '服务器未配置 DEEPSEEK_API_KEY 或 OPENAI_COMPATIBLE_API_KEY，请检查环境变量。' },
        { status: 500 },
      )
    }

    const systemPrompt = [
      '你是一个严谨的视频字幕分析助手。回答要清晰、具体、可复查。',
      '请严格使用 Markdown 输出。',
      '时间戳只能使用 [MM:SS]、[HH:MM:SS] 或 [MM:SS-MM:SS] 形式。',
      '时间戳必须对应字幕中真实出现的内容，不要编造不存在的时间点。',
    ].join('\n')

    const userPrompt = `${template.instruction}

视频标题：${videoTitle}
视频地址：${url}

字幕如下：

${subtitleText}`

    const chatEndpoint = `${apiBase.replace(/\/+$/, '')}/chat/completions`

    const aiResponse = await fetch(chatEndpoint, {
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

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      return Response.json({ error: `DeepSeek API 请求失败: ${aiResponse.status} - ${errText}` }, { status: 500 })
    }

    // 3. Pipe DeepSeek stream to frontend
    const stream = new ReadableStream({
      async start(controller) {
        if (!aiResponse.body) {
          controller.close()
          return
        }
        const reader = aiResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          // Prepend video metadata header so the client knows the title and subtitle text
          const metaPayload = JSON.stringify({ videoTitle, subtitleText }) + '\n===METADATA_END===\n'
          controller.enqueue(new TextEncoder().encode(metaPayload))

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              if (trimmed === 'data: [DONE]') continue

              if (trimmed.startsWith('data:')) {
                try {
                  const data = JSON.parse(trimmed.slice(5).trim())
                  const content = data.choices?.[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content))
                  }
                } catch (e) {
                  console.error('SSE JSON error', trimmed, e)
                }
              }
            }
          }

          // Flush remaining buffer
          if (buffer.startsWith('data:') && buffer.trim() !== 'data: [DONE]') {
            try {
              const data = JSON.parse(buffer.slice(5).trim())
              const content = data.choices?.[0]?.delta?.content || ''
              if (content) {
                controller.enqueue(new TextEncoder().encode(content))
              }
            } catch {}
          }
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
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
