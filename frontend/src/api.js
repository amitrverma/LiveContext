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

export async function uploadCallRecording(apiBaseUrl, callId, file) {
  const response = await fetch(`${apiBaseUrl}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call_id: callId,
      file_name: file.name,
      content_type: file.type || 'application/octet-stream'
    })
  })

  if (!response.ok) {
    throw new Error('Failed to request upload URL')
  }

  const payload = await response.json()
  const uploadResponse = await fetch(payload.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload recording')
  }

  return payload
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
