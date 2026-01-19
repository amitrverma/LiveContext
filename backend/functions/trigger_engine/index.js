const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')
const { getCallState, updateCallState } = require('../../lib/dynamo')

const COOLDOWN_MS = 12000

function evaluateTriggers(segment, contextWindow) {
  if (process.env.MOCK_TRIGGERS === 'true') {
    return {
      type: 'customer_problem_statement',
      confidence: 0.7
    }
  }

  // TODO: Implement trigger rules for problem statement, lookup prompt, sentiment shift, and topic change.
  return null
}

exports.handler = async (event) => {
  const detail = event.detail || {}
  const segment = detail.segment
  const contextWindow = detail.context_window

  if (!segment || !contextWindow) {
    return
  }

  const callId = segment.call_id
  const state = (await getCallState(callId)) || {}
  const lastTrigger = state.last_trigger_ts || 0
  const now = Date.now()

  if (now - lastTrigger < COOLDOWN_MS) {
    return
  }

  const trigger = evaluateTriggers(segment, contextWindow)
  if (!trigger) {
    return
  }

  await updateCallState(callId, { last_trigger_ts: now })

  await emitEvent(DETAIL_TYPES.TRIGGER_FIRED, {
    call_id: callId,
    trigger_type: trigger.type,
    segment,
    context_window: contextWindow
  })
}
