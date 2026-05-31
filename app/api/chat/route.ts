import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { messages, subtitleText, videoTitle } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: '请提供有效的对话消息历史。' }, { status: 400 })
    }

    if (!subtitleText) {
      return Response.json({ error: '缺少视频字幕上下文，请先进行视频总结。' }, { status: 400 })
    }

    // 1. Call DeepSeek API with streaming
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
    const apiBase = process.env.DEEPSEEK_API_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com'
    const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'

    if (!apiKey) {
      return Response.json({ error: '服务器未配置 DEEPSEEK_API_KEY 或 OPENAI_COMPATIBLE_API_KEY，请检查环境变量。' }, { status: 500 })
    }

    const systemPrompt = [
      `你是一个严谨的视频字幕问答助手。正在就视频《${videoTitle || '当前视频'}》的内容提供答疑。`,
      '你的回答必须严格基于提供的字幕内容。如果用户问到的信息在字幕中没有提及，请明确告知用户。',
      '请使用 Markdown 格式回答，可以引用真实的时间戳来帮用户定位。',
      '如果需要，可以输出图片标签表示当时视频画面，格式为独占一行的：[<image>@MM:SS]，例如 [<image>@03:45]。',
      '请务必保证图片标签和时间戳完全对应字幕中真实出现的时间点，绝对不要编造。',
      '\n--- 视频字幕上下文开始 ---',
      subtitleText,
      '--- 视频字幕上下文结束 ---',
    ].join('\n')

    // Prepare full messages array
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: { role: string; content?: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
      })),
    ]

    const chatEndpoint = `${apiBase.replace(/\/+$/, '')}/chat/completions`

    const aiResponse = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.2,
        stream: true,
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      return Response.json({ error: `DeepSeek API 请求失败: ${aiResponse.status} - ${errText}` }, { status: 500 })
    }

    // 2. Stream back the response choice content
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
    console.error('Chat API error:', error)
    const errMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: errMessage || '内部服务器错误' }, { status: 500 })
  }
}
