import { describe, it, expect } from 'vitest'
import { detectSource, extractSourceId } from '../lib/source'

describe('detectSource', () => {
  it('detects a full Bilibili URL', () => {
    expect(detectSource('https://www.bilibili.com/video/BV1te5R6zE5f')).toBe('bilibili')
  })

  it('detects a b23.tv short link', () => {
    expect(detectSource('https://b23.tv/abc123')).toBe('bilibili')
  })

  it('detects a Xiaoyuzhou episode URL', () => {
    expect(detectSource('https://www.xiaoyuzhoufm.com/episode/69d7b5e4e2c8be3155ccc32b')).toBe('xiaoyuzhou')
  })

  it('detects a Snipd episode URL', () => {
    expect(detectSource('https://share.snipd.com/episode/1b4b43d0-0000-0000-0000-000000000000')).toBe('snipd')
  })

  it('returns null for an unrecognised URL', () => {
    expect(detectSource('https://example.com/video/BV1xxx')).toBeNull()
  })

  it('returns null for a bare domain without a path', () => {
    expect(detectSource('https://snipd.com/episode/abc')).toBeNull()
  })
})

describe('extractSourceId', () => {
  it('extracts BV id from a Bilibili URL', () => {
    expect(extractSourceId('https://www.bilibili.com/video/BV1te5R6zE5f', 'bilibili')).toBe('BV1te5R6zE5f')
  })

  it('extracts BV id from a Bilibili URL with query params', () => {
    expect(extractSourceId('https://www.bilibili.com/video/BV1te5R6zE5f?t=123', 'bilibili')).toBe('BV1te5R6zE5f')
  })

  it('returns empty string for an unresolved b23.tv URL (no /video/BV)', () => {
    expect(extractSourceId('https://b23.tv/abc123', 'bilibili')).toBe('')
  })

  it('extracts id from a Xiaoyuzhou episode URL', () => {
    expect(extractSourceId('https://www.xiaoyuzhoufm.com/episode/69d7b5e4e2c8be3155ccc32b', 'xiaoyuzhou')).toBe('69d7b5e4e2c8be3155ccc32b')
  })

  it('extracts UUID from a Snipd episode URL', () => {
    expect(extractSourceId('https://share.snipd.com/episode/1b4b43d0-aaaa-bbbb-cccc-000000000000', 'snipd')).toBe('1b4b43d0-aaaa-bbbb-cccc-000000000000')
  })

  it('returns empty string when the id segment is missing', () => {
    expect(extractSourceId('https://www.xiaoyuzhoufm.com/episodes', 'xiaoyuzhou')).toBe('')
  })
})
