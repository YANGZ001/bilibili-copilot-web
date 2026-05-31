function generateUUID(): string {
  // crypto.randomUUID() requires a secure context (HTTPS/localhost).
  // Fall back to Math.random() for plain-HTTP private network access.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getOrCreateDeviceId(): string {
  const key = 'bilibili_copilot_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = generateUUID()
    localStorage.setItem(key, id)
  }
  return id
}
