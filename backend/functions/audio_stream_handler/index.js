const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {}

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

  await emitEvent(DETAIL_TYPES.AUDIO_CHUNK, detail)

  return { statusCode: 200, body: 'OK' }
}
