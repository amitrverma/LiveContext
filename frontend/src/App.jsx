import React, { useEffect, useRef, useState } from 'react'
import AudioPlayer from './components/AudioPlayer.jsx'
import TranscriptPanel from './components/TranscriptPanel.jsx'
import AssistPanel from './components/AssistPanel.jsx'
import { connectWebSocket, createCall, startCall, uploadCallRecording } from './api.js'
import { startDemoStream } from './mock/demoStream.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL || ''
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export default function App() {
  const [callId, setCallId] = useState(null)
  const [wsUrl, setWsUrl] = useState(WS_URL)
  const [segments, setSegments] = useState([])
  const [partialText, setPartialText] = useState('')
  const [partialUpdatedAt, setPartialUpdatedAt] = useState(0)
  const [assistCard, setAssistCard] = useState(null)
  const [status, setStatus] = useState('idle')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const wsRef = useRef(null)
  const demoStopRef = useRef(null)

  const resetSession = () => {
    setSegments([])
    setPartialText('')
    setAssistCard(null)
    setUploadError(null)
  }

  const handleWsMessage = (payload) => {
    if (payload.type === 'transcript.partial') {
      setPartialText(payload.text)
      setPartialUpdatedAt(Date.now())
    }
    if (payload.type === 'transcript.final') {
      setPartialText('')
      setPartialUpdatedAt(0)
      setSegments((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.provisional) {
          const finalText = payload.segment?.text || ''
          if (last.text === finalText || finalText.includes(last.text) || last.text.includes(finalText)) {
            next.pop()
          }
        }
        next.push(payload.segment)
        return next
      })
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
      if (isUploading) {
        return
      }
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

  const handleAudioEnd = () => {
    if (DEMO_MODE || !callId) {
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'audio_end',
        call_id: callId
      }))
    }
  }

  const handleFileSelected = async (file) => {
    resetSession()
    const activeCallId = await ensureCall()
    if (DEMO_MODE || !activeCallId || !file) {
      return
    }

    setIsUploading(true)
    setUploadError(null)
    try {
      await uploadCallRecording(API_BASE_URL, activeCallId, file)
    } catch (error) {
      setUploadError(error.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!partialText || !partialUpdatedAt) {
        return
      }
      const ageMs = Date.now() - partialUpdatedAt
      if (ageMs < 4000) {
        return
      }
      const snapshot = partialText
      setSegments((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.provisional && last.text === snapshot) {
          return prev
        }
        next.push({
          call_id: callId,
          speaker: 'CUSTOMER',
          text: snapshot,
          end_time: Date.now() / 1000,
          provisional: true
        })
        return next
      })
      setPartialText('')
      setPartialUpdatedAt(0)
    }, 1000)

    return () => clearInterval(interval)
  }, [partialText, partialUpdatedAt, callId])

  return (
    <div className="app">
      <header className="header">
        <div className="title">Call Copilot POC</div>
        <div className="status">Status: {isUploading ? 'uploading' : status}</div>
      </header>
      <main className="grid">
        <AudioPlayer
          onAudioChunk={handleAudioChunk}
          onStreamEnd={handleAudioEnd}
          onPlayStateChange={handlePlayStateChange}
          onFileSelected={handleFileSelected}
          demoMode={DEMO_MODE}
          disabled={isUploading}
        />
        <TranscriptPanel partialText={partialText} segments={segments} />
        <AssistPanel assistCard={assistCard} />
      </main>
      {uploadError ? <div className="error">Upload error: {uploadError}</div> : null}
    </div>
  )
}
