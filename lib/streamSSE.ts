export async function* readSSEChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim())
            const chunk: string = data.choices?.[0]?.delta?.content || ''
            if (chunk) yield chunk
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    }

    // flush remaining buffer
    const trimmed = buffer.trim()
    if (trimmed.startsWith('data:') && trimmed !== 'data: [DONE]') {
      try {
        const data = JSON.parse(trimmed.slice(5).trim())
        const chunk: string = data.choices?.[0]?.delta?.content || ''
        if (chunk) yield chunk
      } catch {
        // malformed final line — skip
      }
    }
  } finally {
    reader.releaseLock()
  }
}
