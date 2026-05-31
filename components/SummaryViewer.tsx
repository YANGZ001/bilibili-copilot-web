'use client'

import React, { useRef, useEffect } from 'react'
import { marked } from 'marked'

interface SummaryViewerProps {
  summary: string
  videoUrl: string
}

export default function SummaryViewer({ summary, videoUrl }: SummaryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Helper: Convert MM:SS or HH:MM:SS to total seconds
  const parseTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number)
    if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  // Preprocess text to replace custom patterns before markdown parsing
  const preprocessText = (text: string): string => {
    let processed = text

    // 1. Ensure all markdown headings are preceded by double newlines so marked parses them correctly as block elements
    processed = processed.replace(/\n(#+ )/g, '\n\n$1')
    processed = processed.replace(/\n{3,}/g, '\n\n')

    // 2. Replace [<image>@MM:SS] or [<image>@HH:MM:SS] with custom HTML card
    processed = processed.replace(
      /\[<image>@([0-9:]+)\]/g,
      `<div class="my-3">
        <button type="button" data-timestamp="$1" class="bili-image-card w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/40 hover:bg-slate-800/60 border border-slate-700/30 text-left transition-all duration-300 group cursor-pointer">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:scale-105 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-200">画面帧快照</p>
              <p class="text-xs text-slate-400">点击定位播放器到 $1</p>
            </div>
          </div>
          <div class="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-pink-400 border border-pink-500/20">
            $1
          </div>
        </button>
      </div>`
    )

    // 3. Replace [MM:SS] or [HH:MM:SS] (excluding the image tags handled above) with clickable badges
    // Avoid double matching by targeting brackets enclosing only numbers and colons
    processed = processed.replace(
      /\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]/g,
      `<span data-timestamp="$1" class="bili-timestamp-badge inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 text-xs font-mono cursor-pointer transition-colors border border-blue-500/20 select-none">$1</span>`
    )

    return processed
  }

  // Handle timestamp click delegation
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Find element with data-timestamp
      const clickableElement = target.closest('[data-timestamp]')
      if (!clickableElement) return

      const timestamp = clickableElement.getAttribute('data-timestamp')
      if (!timestamp) return

      const seconds = parseTimestampToSeconds(timestamp)
      if (seconds > 0 || timestamp === '00:00') {
        e.preventDefault()
        // Build video jump URL
        try {
          const urlObj = new URL(videoUrl)
          urlObj.searchParams.set('t', String(seconds))
          window.open(urlObj.toString(), '_blank')
        } catch {
          // If videoUrl is not a full URL (e.g. just BV), open standard B站 link
          window.open(`https://www.bilibili.com/video/${videoUrl}/?t=${seconds}`, '_blank')
        }
      }
    }

    container.addEventListener('click', handleContainerClick)
    return () => {
      container.removeEventListener('click', handleContainerClick)
    }
  }, [videoUrl])

  // Parse markdown
  const htmlContent = marked.parse(preprocessText(summary), { async: false, breaks: true, gfm: true }) as string

  return (
    <div className="w-full">
      <div 
        ref={containerRef}
        className="markdown-body text-slate-300 w-full"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}
