'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateDeviceId } from '@/lib/device'
import { findTemplate } from '@/lib/prompts'

interface SessionSummary {
  session_id: string
  video_title: string
  conversation_type: string
  last_accessed_at: number
}

function formatDate(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const date = new Date(ts)

  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  if (ts >= todayStart.getTime()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  if (ts >= yesterdayStart.getTime()) return '昨天'

  const diffDays = Math.floor(diff / 86_400_000)
  if (diffDays < 7) return `${diffDays} 天前`

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export default function SessionHistory() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const deviceId = getOrCreateDeviceId()
    fetch(`/api/sessions?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (sessions.length === 0) return null

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md shadow-xl shadow-slate-950/20">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">最近对话</h2>
        <ul className="space-y-1">
          {sessions.map((s) => {
            const template = findTemplate(s.conversation_type)
            return (
              <li key={s.session_id}>
                <button
                  onClick={() => router.push(`/?session=${s.session_id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 transition-colors text-left group"
                >
                  <span className="flex-shrink-0 text-slate-500 group-hover:text-slate-400 text-xs w-24 truncate">
                    {formatDate(s.last_accessed_at)}
                  </span>
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-medium">
                    {template.name}
                  </span>
                  <span className="flex-1 text-sm text-slate-300 group-hover:text-slate-100 truncate transition-colors">
                    {s.video_title}
                  </span>
                  <svg className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
