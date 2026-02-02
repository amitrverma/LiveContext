const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming')
const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const client = new TranscribeStreamingClient({})
const TARGET_SAMPLE_RATE = 16000
const DEFAULT_LANGUAGE = process.env.TRANSCRIBE_LANGUAGE || 'en-US'
const TRANSCRIBE_MODE = process.env.TRANSCRIBE_MODE || 'streaming'

const MOCK_SEGMENTS = [
  { speaker: 'CUSTOMER', text: 'I need help with my order.' },
  { speaker: 'AGENT', text: 'Let me look that up.' },
  { speaker: 'CUSTOMER', text: 'It arrived late and damaged.' },
  { speaker: 'AGENT', text: 'I can start a replacement request.' }
]

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

async function* audioStreamFromBuffer(buffer, chunkSize) {
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const slice = buffer.slice(offset, offset + chunkSize)
    yield { AudioEvent: { AudioChunk: slice } }
  }
}

exports.handler = async (event) => {
  const detail = event.detail || {}

  if (process.env.MOCK_STT === 'true') {
    const index = detail.sequence % MOCK_SEGMENTS.length
    const segment = MOCK_SEGMENTS[index]
    const partialPayload = {
      call_id: detail.call_id,
      text: segment.text,
      speaker: segment.speaker
    }

    const finalPayload = {
      call_id: detail.call_id,
      segment: {
        call_id: detail.call_id,
        speaker: segment.speaker,
        text: segment.text,
        end_time: (detail.sequence || 0) * 0.5
      }
    }

    await emitEvent(DETAIL_TYPES.TRANSCRIPT_PARTIAL, partialPayload)
    await emitEvent(DETAIL_TYPES.TRANSCRIPT_FINAL, finalPayload)
    return
  }

  if (TRANSCRIBE_MODE !== 'streaming') {
    return
  }

  if (!detail.audio_base64 || !detail.call_id) {
    return
  }

  const inputRate = detail.sample_rate || TARGET_SAMPLE_RATE
  const pcmBuffer = Buffer.from(detail.audio_base64, 'base64')
  const inputPcm = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, Math.floor(pcmBuffer.byteLength / 2))
  const resampled = resamplePcm16(inputPcm, inputRate, TARGET_SAMPLE_RATE)
  const audioBuffer = Buffer.from(resampled.buffer, resampled.byteOffset, resampled.byteLength)
  const chunkSize = TARGET_SAMPLE_RATE * 2 * 0.1

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: DEFAULT_LANGUAGE,
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: TARGET_SAMPLE_RATE,
    AudioStream: audioStreamFromBuffer(audioBuffer, chunkSize)
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
          call_id: detail.call_id,
          text: alternative.Transcript,
          speaker: 'CUSTOMER'
        })
        continue
      }

      await emitEvent(DETAIL_TYPES.TRANSCRIPT_FINAL, {
        call_id: detail.call_id,
        segment: {
          call_id: detail.call_id,
          speaker: 'CUSTOMER',
          text: alternative.Transcript,
          end_time: Number(result.EndTime || (detail.sequence || 0) * 0.5)
        }
      })
    }
  }
}
