export async function createCall(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/calls`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Failed to create call')
  }
  return response.json()
}

export async function startCall(apiBaseUrl, callId) {
  const response = await fetch(`${apiBaseUrl}/calls/${callId}/start`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Failed to start call')
  }
  return response.json()
}

export function connectWebSocket(wsUrl, callId, handlers) {
  const socket = new WebSocket(`${wsUrl}?call_id=${callId}`)

  socket.onopen = () => handlers.onOpen?.()
  socket.onclose = () => handlers.onClose?.()
  socket.onerror = () => handlers.onError?.()
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      handlers.onMessage?.(payload)
    } catch (error) {
      handlers.onError?.(error)
    }
  }

  return socket
}
