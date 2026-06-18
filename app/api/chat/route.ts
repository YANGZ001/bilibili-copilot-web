import { NextRequest } from 'next/server'
import { buildChatSystemPrompt } from '@/lib/prompts'
import { getLLMConfig } from '@/lib/llm'
import { readSSEChunks } from '@/lib/streamSSE'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { messages, subtitleText, videoTitle } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: '请提供有效的对话消息历史。' }, { status: 400 })
    }

    if (!subtitleText) {
      return Response.json({ error: '缺少音视频字幕上下文，请先进行音视频总结。' }, { status: 400 })
    }

    const { apiKey, chatEndpoint, model } = getLLMConfig()
    if (!apiKey) {
      return Response.json({ error: '服务器未配置 DEEPSEEK_API_KEY 或 OPENAI_COMPATIBLE_API_KEY，请检查环境变量。' }, { status: 500 })
    }

    const systemPrompt = buildChatSystemPrompt(subtitleText, videoTitle)
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: { role: string; content?: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
      })),
    ]

    const aiResponse = await fetch(chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: formattedMessages, temperature: 0.2, stream: true }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      return Response.json({ error: `DeepSeek API 请求失败: ${aiResponse.status} - ${errText}` }, { status: 500 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        if (!aiResponse.body) { controller.close(); return }
        const enc = new TextEncoder()

        try {
          for await (const chunk of readSSEChunks(aiResponse.body)) {
            controller.enqueue(enc.encode(chunk))
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
        'Content-Type': 'text/plain; charset=utf-8',
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
