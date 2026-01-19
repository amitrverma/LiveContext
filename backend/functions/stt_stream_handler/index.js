const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const MOCK_SEGMENTS = [
  { speaker: 'CUSTOMER', text: 'I need help with my order.' },
  { speaker: 'AGENT', text: 'Let me look that up.' },
  { speaker: 'CUSTOMER', text: 'It arrived late and damaged.' },
  { speaker: 'AGENT', text: 'I can start a replacement request.' }
]

exports.handler = async (event) => {
  const detail = event.detail || {}

  if (process.env.MOCK_STT !== 'true') {
    // TODO: Stream audio to AWS Transcribe Streaming and emit partial/final transcripts.
    return
  }

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
}
