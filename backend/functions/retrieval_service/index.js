const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const MOCK_FACTS = [
  'Ticket #1123 is open for late delivery',
  'Order 98342 shipped 3 days late'
]

exports.handler = async (event) => {
  const detail = event.detail || {}
  const callId = detail.call_id

  if (process.env.MOCK_RETRIEVAL !== 'true') {
    // TODO: Fetch tickets and orders for the caller.
    return
  }

  const facts = MOCK_FACTS.slice(0, 2)
  if (facts.length === 0) {
    return
  }

  await emitEvent(DETAIL_TYPES.FACTS_RETRIEVED, {
    call_id: callId,
    facts,
    sources: ['Tickets', 'Orders'],
    context_snippet: detail.segment?.text || ''
  })
}
