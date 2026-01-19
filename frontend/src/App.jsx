import React, { useEffect, useRef, useState } from 'react'
import AudioPlayer from './components/AudioPlayer.jsx'
import TranscriptPanel from './components/TranscriptPanel.jsx'
import AssistPanel from './components/AssistPanel.jsx'
import { connectWebSocket, createCall, startCall } from './api.js'
import { startDemoStream } from './mock/demoStream.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL || ''
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export default function App() {
  const [callId, setCallId] = useState(null)
  const [wsUrl, setWsUrl] = useState(WS_URL)
  const [segments, setSegments] = useState([])
  const [partialText, setPartialText] = useState('')
  const [assistCard, setAssistCard] = useState(null)
  const [status, setStatus] = useState('idle')
  const wsRef = useRef(null)
  const demoStopRef = useRef(null)

  const resetSession = () => {
    setSegments([])
    setPartialText('')
    setAssistCard(null)
  }

  const handleWsMessage = (payload) => {
    if (payload.type === 'transcript.partial') {
      setPartialText(payload.text)
    }
    if (payload.type === 'transcript.final') {
      setPartialText('')
      setSegments((prev) => [...prev, payload.segment])
    }
    if (payload.type === 'assist.card') {
      setAssistCard(payload.card)
    }
  }

  const ensureCall = async () => {
    if (DEMO_MODE) {
      setCallId('demo')
      return 'demo'
    }
    if (callId) {
      return callId
    }
    const response = await createCall(API_BASE_URL)
    setCallId(response.call_id)
    if (response.ws_url) {
      setWsUrl(response.ws_url)
    }
    return response.call_id
  }

  const handlePlayStateChange = async (nextStatus) => {
    setStatus(nextStatus)

    if (nextStatus === 'playing') {
      const activeCallId = await ensureCall()
      if (!DEMO_MODE && activeCallId) {
        await startCall(API_BASE_URL, activeCallId)
      }
    }
  }

  const handleAudioChunk = (chunk) => {
    if (DEMO_MODE || !callId) {
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'audio_chunk',
        call_id: callId,
        ...chunk
      }))
    }
  }

  const handleFileSelected = async () => {
    resetSession()
    await ensureCall()
  }

  useEffect(() => {
    if (DEMO_MODE || !callId || !wsUrl) {
      return
    }

    const socket = connectWebSocket(wsUrl, callId, {
      onOpen: () => {
        socket.send(JSON.stringify({ action: 'register', call_id: callId }))
      },
      onMessage: handleWsMessage
    })

    wsRef.current = socket
    return () => socket.close()
  }, [callId, wsUrl])

  useEffect(() => {
    if (!DEMO_MODE || status !== 'playing') {
      demoStopRef.current?.()
      return
    }

    demoStopRef.current = startDemoStream({
      onTranscriptPartial: setPartialText,
      onTranscriptFinal: (segment) => setSegments((prev) => [...prev, segment]),
      onAssistCard: setAssistCard
    })

    return () => demoStopRef.current?.()
  }, [status])

  return (
    <div className="app">
      <header className="header">
        <div className="title">Call Copilot POC</div>
        <div className="status">Status: {status}</div>
      </header>
      <main className="grid">
        <AudioPlayer
          onAudioChunk={handleAudioChunk}
          onPlayStateChange={handlePlayStateChange}
          onFileSelected={handleFileSelected}
          demoMode={DEMO_MODE}
        />
        <TranscriptPanel partialText={partialText} segments={segments} />
        <AssistPanel assistCard={assistCard} />
      </main>
    </div>
  )
}
