'use client'

import React, { useState, useRef, useEffect } from 'react'
import { marked } from 'marked'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface VideoChatProps {
  videoTitle: string
  subtitleText: string
  videoUrl: string
}

export default function VideoChat({ videoTitle, subtitleText, videoUrl }: VideoChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages or loading state without scrolling the window
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Helper: Convert MM:SS or HH:MM:SS to total seconds
  const parseTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number)
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  // Preprocess text to format timestamps & image frames
  const preprocessText = (text: string): string => {
    let processed = text

    // Ensure all markdown headings are preceded by double newlines so marked parses them correctly
    processed = processed.replace(/\n(#+ )/g, '\n\n$1')
    processed = processed.replace(/\n{3,}/g, '\n\n')

    processed = processed.replace(
      /\[<image>@([0-9:]+)\]/g,
      `<div class="my-2">
        <button type="button" data-timestamp="$1" class="bili-image-card flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40 text-left transition-all text-xs cursor-pointer group">
          <span class="w-6 h-6 flex items-center justify-center rounded bg-pink-500/10 text-pink-400 group-hover:scale-105 transition-transform">🖼️</span>
          <span>定位画面帧 @ $1</span>
        </button>
      </div>`
    )
    processed = processed.replace(
      /\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]/g,
      `<span data-timestamp="$1" class="bili-timestamp-badge inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 text-xs font-mono cursor-pointer transition-colors border border-blue-500/20 select-none">$1</span>`
    )
    return processed
  }

  // Delegate click handler for timestamps in messages
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const clickableElement = target.closest('[data-timestamp]')
      if (!clickableElement) return

      const timestamp = clickableElement.getAttribute('data-timestamp')
      if (!timestamp) return

      const seconds = parseTimestampToSeconds(timestamp)
      if (seconds > 0 || timestamp === '00:00') {
        e.preventDefault()
        try {
          const urlObj = new URL(videoUrl)
          urlObj.searchParams.set('t', String(seconds))
          window.open(urlObj.toString(), '_blank')
        } catch {
          window.open(`https://www.bilibili.com/video/${videoUrl}/?t=${seconds}`, '_blank')
        }
      }
    }

    container.addEventListener('click', handleContainerClick)
    return () => {
      container.removeEventListener('click', handleContainerClick)
    }
  }, [videoUrl])

  // Submit follow-up question
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessageContent = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message locally
    const updatedMessages = [...messages, { role: 'user', content: userMessageContent } as Message]
    setMessages(updatedMessages)

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch('/app/../api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          subtitleText,
          videoTitle,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '请求对话失败')
      }

      if (!response.body) {
        throw new Error('未接收到流数据')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        accumulatedText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const next = [...prev]
          const lastMsg = next[next.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = accumulatedText
          }
          return next
        })
      }
    } catch (error: unknown) {
      console.error('Chat error:', error)
      const errMessage = error instanceof Error ? error.message : String(error)
      setMessages((prev) => {
        const next = [...prev]
        const lastMsg = next[next.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = `❌ 出错了: ${errMessage || '网络连接异常'}`
        }
        return next
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[550px] rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-950/30 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
          <h4 className="text-sm font-semibold text-slate-200">视频 AI 课代表 答疑室</h4>
        </div>
        <button
          onClick={() => setMessages([])}
          disabled={messages.length === 0 || isLoading}
          className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
        >
          清空对话
        </button>
      </div>

      {/* Message list */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-sm font-medium text-slate-300">对总结内容不解？</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
              可以直接向 AI 提出有关视频的任何具体问题，课代表会根据原文字幕为你解答。
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={index}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-900/10'
                      : 'bg-slate-800/60 border border-slate-700/30 text-slate-200 rounded-bl-none prose prose-invert prose-xs max-w-none'
                  }`}
                >
                  {isUser ? (
                    msg.content
                  ) : msg.content ? (
                    <div 
                      className="markdown-body"
                      dangerouslySetInnerHTML={{ 
                        __html: marked.parse(preprocessText(msg.content), { async: false, breaks: true, gfm: true }) as string 
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-slate-950/20 border-t border-slate-800/40"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? 'AI 正在思考...' : '向课代表继续提问视频细节...'}
            className="w-full pl-4 pr-12 py-3 bg-slate-950/40 border border-slate-800 hover:border-slate-700/60 focus:border-indigo-500 rounded-xl text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </form>
    </div>
  )
}
