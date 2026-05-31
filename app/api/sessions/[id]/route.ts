import { NextRequest } from 'next/server'
import { getSession, updateLastAccessed, isExpired } from '@/lib/db/sessions'
import { getMessages } from '@/lib/db/messages'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = getSession(id)

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    if (isExpired(session)) {
      return Response.json({ error: 'Session expired' }, { status: 410 })
    }

    updateLastAccessed(id)
    const messages = getMessages(id)

    return Response.json({
      session_id: session.session_id,
      video_id: session.video_id,
      video_title: session.video_title,
      conversation_type: session.conversation_type,
      created_at: session.created_at,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
  } catch (error: unknown) {
    console.error('GET /api/sessions/[id] error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
