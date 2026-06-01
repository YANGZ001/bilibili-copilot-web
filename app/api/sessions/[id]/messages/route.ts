import { NextRequest } from 'next/server'
import { getSession, updateLastAccessed, isExpired } from '@/lib/db/sessions'
import { getMessages, appendMessages, replaceMessages } from '@/lib/db/messages'
import { getLLMConfig } from '@/lib/llm'
import { readSSEChunks } from '@/lib/streamSSE'
import { buildChatSystemPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

const MAX_HISTORY_MESSAGES = 20

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
    // Filter out any legacy system-message rows, then cap to last N messages
    const recentHistory = history
      .filter((m) => m.role !== 'system')
      .slice(-MAX_HISTORY_MESSAGES)

    const systemPrompt = buildChatSystemPrompt(session.subtitle_text, session.video_title)
    const messagesForLLM = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    const { apiKey, chatEndpoint, model } = getLLMConfig()
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

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
        const enc = new TextEncoder()

        try {
          for await (const chunk of readSSEChunks(aiResponse.body)) {
            assistantContent += chunk
            controller.enqueue(enc.encode(chunk))
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('POST /api/sessions/[id]/messages error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { messages } = await req.json()

    if (!Array.isArray(messages)) {
      return Response.json({ error: 'messages must be an array' }, { status: 400 })
    }

    const session = getSession(id)
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }
    if (isExpired(session)) {
      return Response.json({ error: 'Session expired' }, { status: 410 })
    }

    // Filter system messages before storing
    const userMessages = messages.filter((m: { role: string }) => m.role !== 'system')
    replaceMessages(id, userMessages)
    updateLastAccessed(id)

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('PUT /api/sessions/[id]/messages error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
