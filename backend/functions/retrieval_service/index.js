const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const SCENARIOS = [
  {
    id: 'delivery_issue',
    match: /late|delayed|missed delivery|not arrive/,
    facts: [
      'Order 98342 shipped 3 days late via ground service',
      'Ticket #1123 opened for delivery delay on 2024-06-12',
      'Customer is eligible for expedited replacement'
    ],
    sources: ['Orders', 'Tickets']
  },
  {
    id: 'damaged_item',
    match: /damaged|broken|defect|crack/,
    facts: [
      'Order 77421 marked as delivered yesterday',
      'Photo evidence required for damage claim',
      'Replacement SKU ABC-441 is in stock'
    ],
    sources: ['Orders', 'Inventory', 'Policy']
  },
  {
    id: 'billing_issue',
    match: /refund|chargeback|charged twice|billing|invoice/,
    facts: [
      'Invoice INV-5541 shows two identical charges',
      'Most recent payment posted at 10:14 AM',
      'Refunds typically settle within 3-5 business days'
    ],
    sources: ['Billing', 'Policy']
  },
  {
    id: 'cancellation_request',
    match: /cancel|cancellation|return/,
    facts: [
      'Order 88109 is still in processing and eligible for cancel',
      'Return window is 30 days from delivery',
      'Restocking fee does not apply for unopened items'
    ],
    sources: ['Orders', 'Policy']
  },
  {
    id: 'account_access',
    match: /password|login|account|reset/,
    facts: [
      'Account shows 3 failed login attempts in the last hour',
      'Password reset link expires after 15 minutes',
      'Multi-factor authentication is enabled'
    ],
    sources: ['Identity', 'Security']
  },
  {
    id: 'general_inquiry',
    match: /.*/,
    facts: [
      'Customer has 2 open tickets in the last 90 days',
      'Preferred contact method is email',
      'Average resolution time is 24 hours'
    ],
    sources: ['CRM', 'Support']
  }
]

function selectScenario(text) {
  const normalized = text.toLowerCase()
  return SCENARIOS.find((scenario) => scenario.match.test(normalized)) || SCENARIOS[SCENARIOS.length - 1]
}

exports.handler = async (event) => {
  const detail = event.detail || {}
  const callId = detail.call_id

  if (process.env.MOCK_RETRIEVAL !== 'true') {
    // TODO: Fetch tickets and orders for the caller.
    return
  }

  const contextText = detail.segment?.text || detail.context_window?.segments?.map((item) => item.text || '').join(' ') || ''
  const scenario = selectScenario(contextText)
  const facts = scenario.facts.slice(0, 3)
  if (facts.length === 0) {
    return
  }

  await emitEvent(DETAIL_TYPES.FACTS_RETRIEVED, {
    call_id: callId,
    facts,
    sources: scenario.sources,
    context_snippet: detail.segment?.text || ''
  })
}
