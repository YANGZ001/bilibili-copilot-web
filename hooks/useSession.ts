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
        if (res.status === 410) {
          setExpired(true)
          return
        }
        if (res.status === 404) {
          return
        }
        if (!res.ok) {
          console.error('Failed to load session', res.status)
          return
        }

        const data = await res.json()
        const messages: Array<{ role: string; content: string }> = data.messages || []

        const systemMsg = messages.find((m) => m.role === 'system')
        const subtitleText = extractSubtitleText(systemMsg?.content || '')

        const nonSystemMessages = messages.filter((m) => m.role !== 'system')
        const firstAssistantIdx = nonSystemMessages.findIndex((m) => m.role === 'assistant')
        const summary = firstAssistantIdx >= 0 ? nonSystemMessages[firstAssistantIdx].content : ''
        const chatMessages = nonSystemMessages.slice(firstAssistantIdx + 1) as ChatMessage[]

        setSession({
          session_id: data.session_id,
          video_id: data.video_id,
          video_title: data.video_title,
          video_url: `https://www.bilibili.com/video/${data.video_id}`,
          conversation_type: data.conversation_type,
          summary,
          chatMessages,
          subtitleText,
        })
      })
      .catch((err) => console.error('useSession fetch error:', err))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { sessionId, session, loading, expired }
}

function extractSubtitleText(systemContent: string): string {
  const start = '--- 视频字幕上下文开始 ---'
  const end = '--- 视频字幕上下文结束 ---'
  const startIdx = systemContent.indexOf(start)
  const endIdx = systemContent.indexOf(end)
  if (startIdx === -1 || endIdx === -1) return ''
  return systemContent.slice(startIdx + start.length, endIdx).trim()
}
