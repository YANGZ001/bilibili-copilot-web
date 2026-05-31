import { NextRequest } from 'next/server'
import { getSession, updateLastAccessed, isExpired } from '@/lib/db/sessions'
import { getMessages, appendMessages } from '@/lib/db/messages'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { role, content } = await req.json()

    if (!content || role !== 'user') {
      return Response.json({ error: 'Missing or invalid message' }, { status: 400 })
    }

    const session = getSession(id)
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }
    if (isExpired(session)) {
      return Response.json({ error: 'Session expired' }, { status: 410 })
    }

    updateLastAccessed(id)

    const history = getMessages(id)
    const messagesForLLM = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
    const apiBase = process.env.DEEPSEEK_API_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.deepseek.com'
    const model = process.env.DEEPSEEK_MODEL || process.env.OPENAI_COMPATIBLE_MODEL || 'deepseek-chat'

    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    const chatEndpoint = `${apiBase.replace(/\/+$/, '')}/chat/completions`
    const aiResponse = await fetch(chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: messagesForLLM, temperature: 0.2, stream: true }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      return Response.json({ error: `LLM API error: ${aiResponse.status} - ${errText}` }, { status: 500 })
    }

    const userMessage = { role: 'user', content }
    let assistantContent = ''

    const stream = new ReadableStream({
      async start(controller) {
        if (!aiResponse.body) { controller.close(); return }
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
                  const chunk = data.choices?.[0]?.delta?.content || ''
                  if (chunk) {
                    assistantContent += chunk
                    controller.enqueue(new TextEncoder().encode(chunk))
                  }
                } catch (e) {
                  console.error('SSE JSON parse error', e)
                }
              }
            }
          }

          if (buffer.startsWith('data:') && buffer.trim() !== 'data: [DONE]') {
            try {
              const data = JSON.parse(buffer.slice(5).trim())
              const chunk = data.choices?.[0]?.delta?.content || ''
              if (chunk) {
                assistantContent += chunk
                controller.enqueue(new TextEncoder().encode(chunk))
              }
            } catch {}
          }

          appendMessages(id, [userMessage, { role: 'assistant', content: assistantContent }])
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
    console.error('POST /api/sessions/[id]/messages error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
