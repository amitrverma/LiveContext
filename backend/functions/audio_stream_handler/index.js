const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming')
const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const client = new TranscribeStreamingClient({})
const TARGET_SAMPLE_RATE = 16000
const DEFAULT_LANGUAGE = process.env.TRANSCRIBE_LANGUAGE || 'en-US'
const TRANSCRIBE_MODE = process.env.TRANSCRIBE_MODE || 'streaming'

const activeStreams = new Map()

class AudioChunkQueue {
  constructor() {
    this.queue = []
    this.waiters = []
    this.closed = false
  }

  push(buffer) {
    if (this.closed) {
      return
    }
    if (this.waiters.length) {
      const resolve = this.waiters.shift()
      resolve({ value: { AudioEvent: { AudioChunk: buffer } }, done: false })
      return
    }
    this.queue.push(buffer)
  }

  close() {
    if (this.closed) {
      return
    }
    this.closed = true
    while (this.waiters.length) {
      const resolve = this.waiters.shift()
      resolve({ done: true })
    }
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length) {
        const buffer = this.queue.shift()
        yield { AudioEvent: { AudioChunk: buffer } }
        continue
      }
      if (this.closed) {
        return
      }
      const next = await new Promise((resolve) => this.waiters.push(resolve))
      if (next?.done) {
        return
      }
      yield next.value
    }
  }
}

function resamplePcm16(input, inputRate, outputRate) {
  if (!input || inputRate === outputRate) {
    return input
  }

  const ratio = inputRate / outputRate
  const outputLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Int16Array(outputLength)

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    const alpha = position - left
    const value = input[left] + (input[right] - input[left]) * alpha
    output[i] = Math.max(-32768, Math.min(32767, Math.round(value)))
  }

  return output
}

function enqueuePcm(queue, audioBuffer) {
  const sliceSize = TARGET_SAMPLE_RATE * 2 * 0.1
  for (let offset = 0; offset < audioBuffer.length; offset += sliceSize) {
    queue.push(audioBuffer.slice(offset, offset + sliceSize))
  }
}

async function startTranscriptionStream(callId, queue) {
  const command = new StartStreamTranscriptionCommand({
    LanguageCode: DEFAULT_LANGUAGE,
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: TARGET_SAMPLE_RATE,
    AudioStream: queue
  })

  const response = await client.send(command)
  for await (const streamEvent of response.TranscriptResultStream) {
    const results = streamEvent.TranscriptEvent?.Transcript?.Results || []
    for (const result of results) {
      const alternative = result.Alternatives?.[0]
      if (!alternative?.Transcript) {
        continue
      }

      if (result.IsPartial) {
        await emitEvent(DETAIL_TYPES.TRANSCRIPT_PARTIAL, {
          call_id: callId,
          text: alternative.Transcript,
          speaker: 'CUSTOMER'
        })
        continue
      }

      await emitEvent(DETAIL_TYPES.TRANSCRIPT_FINAL, {
        call_id: callId,
        segment: {
          call_id: callId,
          speaker: 'CUSTOMER',
          text: alternative.Transcript,
          end_time: Number(result.EndTime || 0)
        }
      })
    }
  }
}

function getOrCreateStream(callId) {
  const existing = activeStreams.get(callId)
  if (existing) {
    return existing
  }

  const queue = new AudioChunkQueue()
  const streamPromise = startTranscriptionStream(callId, queue)
    .catch((error) => {
      console.error('transcribe stream failed', { callId, error: error?.message })
    })
    .finally(() => {
      activeStreams.delete(callId)
    })

  const streamState = { queue, streamPromise }
  activeStreams.set(callId, streamState)
  return streamState
}

exports.handler = async (event) => {
  let body = {}
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch (error) {
    console.error('Invalid JSON body', { error: error?.message, body: event.body })
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  console.log('audio_chunk received', {
    requestId: event.requestContext?.requestId,
    connectionId: event.requestContext?.connectionId,
    action: body.action,
    callId: body.call_id,
    sequence: body.sequence
  })

  if (!body.action) {
    return { statusCode: 400, body: 'Missing action' }
  }

  if (body.action === 'audio_end') {
    if (body.call_id) {
      const stream = activeStreams.get(body.call_id)
      stream?.queue?.close()
      activeStreams.delete(body.call_id)
    }
    return { statusCode: 200, body: 'OK' }
  }

  if (body.action !== 'audio_chunk') {
    return { statusCode: 200, body: 'Ignored' }
  }

  const detail = {
    call_id: body.call_id,
    sequence: body.sequence,
    audio_base64: body.audio_base64,
    sample_rate: body.sample_rate,
    channels: body.channels,
    received_at: Date.now()
  }

  if (TRANSCRIBE_MODE === 'streaming') {
    if (!detail.audio_base64 || !detail.call_id) {
      return { statusCode: 200, body: 'Missing audio' }
    }
    const inputRate = detail.sample_rate || TARGET_SAMPLE_RATE
    const pcmBuffer = Buffer.from(detail.audio_base64, 'base64')
    const inputPcm = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, Math.floor(pcmBuffer.byteLength / 2))
    const resampled = resamplePcm16(inputPcm, inputRate, TARGET_SAMPLE_RATE)
    const audioBuffer = Buffer.from(resampled.buffer, resampled.byteOffset, resampled.byteLength)

    const stream = getOrCreateStream(detail.call_id)
    enqueuePcm(stream.queue, audioBuffer)
  } else {
    try {
      await emitEvent(DETAIL_TYPES.AUDIO_CHUNK, detail)
    } catch (error) {
      console.error('emitEvent failed', { error: error?.message, detailType: DETAIL_TYPES.AUDIO_CHUNK })
      throw error
    }
  }

  return { statusCode: 200, body: 'OK' }
}
