'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SessionData {
  session_id: string
  video_id: string
  video_title: string
  video_url: string
  conversation_type: string
  summary: string
  chatMessages: ChatMessage[]
  subtitleText: string
}

export function useSession() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setExpired(false)
      return
    }

    setLoading(true)
    setSession(null)
    setExpired(false)

    fetch(`/api/sessions/${sessionId}`)
      .then(async (res) => {
        if (res.status === 410) { setExpired(true); return }
        if (res.status === 404) { return }
        if (!res.ok) { console.error('Failed to load session', res.status); return }

        const data = await res.json()
        // Filter any legacy system-message rows that may exist in old sessions
        const messages: Array<{ role: string; content: string }> = (data.messages || []).filter(
          (m: { role: string }) => m.role !== 'system'
        )

        const firstAssistantIdx = messages.findIndex((m) => m.role === 'assistant')
        if (firstAssistantIdx === -1) {
          setSession({
            session_id: data.session_id,
            video_id: data.video_id,
            video_title: data.video_title,
            video_url: data.source_url || `https://www.bilibili.com/video/${data.video_id}`,
            conversation_type: data.conversation_type,
            summary: '',
            chatMessages: [],
            subtitleText: data.subtitle_text || '',
          })
          return
        }

        const summary = messages[firstAssistantIdx].content
        const chatMessages = messages.slice(firstAssistantIdx + 1) as ChatMessage[]

        setSession({
          session_id: data.session_id,
          video_id: data.video_id,
          video_title: data.video_title,
          video_url: data.source_url || `https://www.bilibili.com/video/${data.video_id}`,
          conversation_type: data.conversation_type,
          summary,
          chatMessages,
          subtitleText: data.subtitle_text || '',
        })
      })
      .catch((err) => console.error('useSession fetch error:', err))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { sessionId, session, loading, expired }
}
