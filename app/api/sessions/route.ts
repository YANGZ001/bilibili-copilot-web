import { NextRequest } from 'next/server'
import { createSession, listSessionsByDevice } from '@/lib/db/sessions'
import { appendMessages } from '@/lib/db/messages'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { device_id, video_id, video_title, conversation_type, subtitle_text, messages } = await req.json()

    if (!device_id || !video_id || !video_title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const session_id = crypto.randomUUID()

    createSession({
      session_id,
      device_id,
      video_id,
      video_title,
      conversation_type: conversation_type || 'summarize',
      subtitle_text: subtitle_text || '',
    })

    // Store only user/assistant messages — no system messages
    const userMessages = Array.isArray(messages)
      ? messages.filter((m: { role: string }) => m.role !== 'system')
      : []
    if (userMessages.length > 0) {
      appendMessages(session_id, userMessages)
    }

    return Response.json({ session_id })
  } catch (error: unknown) {
    console.error('POST /api/sessions error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const device_id = req.nextUrl.searchParams.get('device_id')
    if (!device_id) {
      return Response.json({ error: 'Missing device_id' }, { status: 400 })
    }

    const sessions = listSessionsByDevice(device_id)
    return Response.json(sessions)
  } catch (error: unknown) {
    console.error('GET /api/sessions error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
