const { broadcastToCall } = require('../../lib/websocket')
const { DETAIL_TYPES } = require('../../lib/constants')

exports.handler = async (event) => {
  const detailType = event['detail-type']
  const detail = event.detail || {}
  const callId = detail.call_id

  if (!callId) {
    return
  }

  if (detailType === DETAIL_TYPES.TRANSCRIPT_PARTIAL) {
    await broadcastToCall(callId, {
      type: 'transcript.partial',
      text: detail.text,
      speaker: detail.speaker
    })
    return
  }

  if (detailType === DETAIL_TYPES.TRANSCRIPT_FINAL) {
    await broadcastToCall(callId, {
      type: 'transcript.final',
      segment: detail.segment
    })
    return
  }

  if (detailType === DETAIL_TYPES.ASSIST_CARD_READY) {
    await broadcastToCall(callId, {
      type: 'assist.card',
      card: detail.card
    })
  }
}
