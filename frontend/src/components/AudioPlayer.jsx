import React, { useEffect, useRef, useState } from 'react'

function floatToPcm16(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32Array.length; i += 1) {
    let sample = Math.max(-1, Math.min(1, float32Array[i]))
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(i * 2, sample, true)
  }
  return buffer
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export default function AudioPlayer({ onAudioChunk, onPlayStateChange, disabled, demoMode, onFileSelected }) {
  const audioRef = useRef(null)
  const contextRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [isReady, setIsReady] = useState(false)
  const sequenceRef = useRef(0)

  const setupAudioGraph = () => {
    if (!audioRef.current || contextRef.current) {
      return
    }

    const context = new AudioContext()
    const source = context.createMediaElementSource(audioRef.current)
    const processor = context.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (event) => {
      if (audioRef.current.paused || demoMode) {
        return
      }
      const channelData = event.inputBuffer.getChannelData(0)
      const pcmBuffer = floatToPcm16(channelData)
      const payload = {
        sequence: sequenceRef.current,
        audio_base64: toBase64(pcmBuffer),
        sample_rate: context.sampleRate,
        channels: 1
      }
      sequenceRef.current += 1
      onAudioChunk?.(payload)
    }

    source.connect(processor)
    processor.connect(context.destination)

    contextRef.current = context
    sourceRef.current = source
    processorRef.current = processor
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const url = URL.createObjectURL(file)
    audioRef.current.src = url
    setFileName(file.name)
    setIsReady(true)
    sequenceRef.current = 0
    onFileSelected?.(file)
  }

  const handlePlay = async () => {
    setupAudioGraph()
    await audioRef.current.play()
    onPlayStateChange?.('playing')
  }

  const handlePause = () => {
    audioRef.current.pause()
    onPlayStateChange?.('paused')
  }

  const handleEnded = () => {
    onPlayStateChange?.('ended')
  }

  useEffect(() => {
    return () => {
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()
      contextRef.current?.close()
    }
  }, [])

  return (
    <section className="panel">
      <h2>Audio Player</h2>
      <div className="audio-controls">
        <input type="file" accept="audio/*" onChange={handleFileChange} disabled={disabled} />
        <div className="file-name">{fileName || 'No file selected'}</div>
        <div className="buttons">
          <button type="button" onClick={handlePlay} disabled={!isReady || disabled}>
            Play
          </button>
          <button type="button" onClick={handlePause} disabled={!isReady || disabled}>
            Pause
          </button>
        </div>
      </div>
      <audio ref={audioRef} onEnded={handleEnded} controls preload="auto" />
      <p className="hint">Audio is streamed in real time; transcription never pauses.</p>
    </section>
  )
}
