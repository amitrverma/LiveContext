const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')
const { getCallState, updateCallState } = require('../../lib/dynamo')

exports.handler = async (event) => {
  const detail = event.detail || {}
  const segment = detail.segment

  if (!segment) {
    return
  }

  const callId = segment.call_id
  const state = (await getCallState(callId)) || {}
  const windowSeconds = state.window_seconds || 15
  const existing = state.context_window?.segments || []

  const segments = [...existing, segment]
  const cutoff = segment.end_time - windowSeconds
  const pruned = segments.filter((item) => item.end_time >= cutoff)

  const contextWindow = {
    call_id: callId,
    window_seconds: windowSeconds,
    segments: pruned
  }

  await updateCallState(callId, {
    context_window: contextWindow
  })

  await emitEvent(DETAIL_TYPES.CONTEXT_UPDATED, {
    call_id: callId,
    context_window: contextWindow,
    segment
  })
}
