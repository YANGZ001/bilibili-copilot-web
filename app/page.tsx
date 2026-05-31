'use client'

import React, { useState } from 'react'
import { defaultTemplates } from '@/lib/prompts'
import SummaryViewer from '@/components/SummaryViewer'
import VideoChat from '@/components/VideoChat'

export default function Home() {
  const [url, setUrl] = useState('')
  const [templateId, setTemplateId] = useState('outline')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [bypassCache, setBypassCache] = useState(false)

  // Video context states
  const [videoTitle, setVideoTitle] = useState('')
  const [subtitleText, setSubtitleText] = useState('')
  const [summary, setSummary] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || isLoading) return

    setIsLoading(true)
    setError('')
    setStatusMessage('正在解析视频 & 提取字幕数据...')
    setSummary('')
    setVideoTitle('')
    setSubtitleText('')

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), templateId, bypassCache }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '生成总结服务失败')
      }

      if (!response.body) {
        throw new Error('服务器未返回可读取的流数据')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let hasParsedMetadata = false
      let currentSummary = ''

      setStatusMessage('课代表正在梳理视频逻辑，请稍候...')
      setVideoUrl(url.trim())

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        if (!hasParsedMetadata) {
          const delimiter = '\n===METADATA_END===\n'
          const index = buffer.indexOf(delimiter)
          if (index !== -1) {
            const metaPart = buffer.slice(0, index)
            const rest = buffer.slice(index + delimiter.length)

            try {
              const metadata = JSON.parse(metaPart.trim())
              setVideoTitle(metadata.videoTitle || 'Bilibili 视频')
              setSubtitleText(metadata.subtitleText || '')
            } catch (err) {
              console.error('Error parsing metadata from stream', err)
            }

            hasParsedMetadata = true
            currentSummary = rest
            setSummary(currentSummary)
            setStatusMessage('') // clear status when generation begins
          }
        } else {
          currentSummary += chunk
          setSummary(currentSummary)
        }
      }
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : String(err)
      setError(message || '发生未知错误，请重试')
      setStatusMessage('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative overflow-x-hidden text-slate-100 bg-[#0a0f1d] selection:bg-indigo-500/30">
      {/* Background glowing gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Slogan */}
        <header className="text-center mb-10 mt-6 sm:mt-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4 tracking-wide uppercase">
            ⚡️ Private & High-Efficiency Bilibili Agent
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-3">
            B站 AI <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">视频课代表</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            基于 deepseek 极速生成视频完整大纲，告别随机丢弃和信息丢失。
            支持多轮深度追问，完美还原视频的每一处细节。
          </p>
        </header>

        {/* Input Form Dashboard */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md shadow-xl shadow-slate-950/20">
            <form onSubmit={handleSummarize} className="space-y-4">
              <div>
                <label htmlFor="video-url" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  视频链接 (支持 BV号 / 网页地址 / b23.tv 短链)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="video-url"
                    type="text"
                    required
                    disabled={isLoading}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="例如: https://www.bilibili.com/video/BV1fX4y1Q7Ux"
                    className="flex-1 px-4 py-3.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700/60 focus:border-indigo-500 rounded-xl text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-medium rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>一键课代表</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Template Mode Selection */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  总结模式
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {defaultTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setTemplateId(tpl.id)}
                      className={`px-3 py-3 rounded-xl border text-xs font-medium text-center transition-all duration-300 cursor-pointer disabled:opacity-50 select-none ${
                        templateId === tpl.id
                          ? 'bg-indigo-500/10 border-indigo-500/60 text-indigo-300 shadow-md shadow-indigo-950/20'
                          : 'bg-slate-950/30 border-slate-800 hover:border-slate-700/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold mb-0.5">{tpl.name}</div>
                      <div className="opacity-60 font-normal scale-[0.95] origin-center truncate">
                        {tpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bypassCache}
                      disabled={isLoading}
                      onChange={(e) => setBypassCache(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500 border-slate-800 bg-slate-950 focus:ring-0 focus:outline-none"
                    />
                    <span>⚡️ 强制刷新 (调试专用：跳过并覆写 Redis 缓存)</span>
                  </label>
                </div>
              )}
            </form>

            {/* Status / Error feedback */}
            {statusMessage && (
              <div className="mt-5 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-400 text-center flex items-center justify-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                {statusMessage}
              </div>
            )}

            {error && (
              <div className="mt-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-3">
                <span className="text-base select-none mt-0.5">⚠️</span>
                <div>
                  <p className="font-semibold">分析失败</p>
                  <p className="text-xs opacity-80 mt-0.5 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Section (Summary + Chat) */}
        {videoTitle && (
          <div className="space-y-6">
            {/* Video Title Banner */}
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <span className="flex-shrink-0 text-xl select-none">📺</span>
                <span className="font-bold text-slate-100 truncate text-sm sm:text-base">{videoTitle}</span>
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>在 B站 播放</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Summary (Prose) */}
              <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md shadow-lg min-h-[450px]">
                {summary ? (
                  <SummaryViewer summary={summary} videoUrl={videoUrl} />
                ) : (
                  <div className="h-full min-h-[350px] flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <div className="w-8 h-8 mx-auto rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                      <p className="text-xs text-slate-500">正在生成总结排版...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Interactive Chat */}
              <div className="lg:col-span-5 lg:sticky lg:top-8">
                <VideoChat
                  videoTitle={videoTitle}
                  subtitleText={subtitleText}
                  videoUrl={videoUrl}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
