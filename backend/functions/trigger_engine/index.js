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

  if (!segment?.text) {
    return null
  }

  const text = segment.text.toLowerCase()
  const recent = (contextWindow?.segments || []).slice(-4).map((item) => item.text?.toLowerCase() || '')
  const windowText = [text, ...recent].join(' ')

  if (windowText.match(/late|delayed|missed delivery|not arrive/)) {
    return { type: 'delivery_issue', confidence: 0.75 }
  }
  if (windowText.match(/damaged|broken|defect|crack/)) {
    return { type: 'damaged_item', confidence: 0.75 }
  }
  if (windowText.match(/refund|chargeback|charged twice|billing|invoice/)) {
    return { type: 'billing_issue', confidence: 0.75 }
  }
  if (windowText.match(/cancel|cancellation|return/)) {
    return { type: 'cancellation_request', confidence: 0.7 }
  }
  if (windowText.match(/password|login|account|reset/)) {
    return { type: 'account_access', confidence: 0.7 }
  }

  return { type: 'general_inquiry', confidence: 0.6 }
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
