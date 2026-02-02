const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const SCENARIOS = [
  {
    id: 'delivery_issue',
    match: /late|delayed|missed delivery|not arrive/,
    sources: ['Orders', 'Tickets'],
    variants: [
      {
        facts: [
          'Order 98342 shipped 3 days late via ground service',
          'Ticket #1123 opened for delivery delay on 2024-06-12',
          'Customer is eligible for expedited replacement'
        ],
        insights: { sentiment: 'frustrated', risk: 'medium' },
        next_steps: [
          'Apologize for the delay and offer expedited replacement.',
          'Confirm delivery address and provide a new ETA.'
        ]
      },
      {
        facts: [
          'Carrier scan shows a missed delivery attempt yesterday',
          'Package is currently held at the local depot',
          'Customer qualifies for a shipping credit'
        ],
        insights: { sentiment: 'impatient', risk: 'low' },
        next_steps: [
          'Offer to arrange a redelivery or hold pickup.',
          'Provide tracking details and confirm preferred resolution.'
        ]
      }
    ]
  },
  {
    id: 'damaged_item',
    match: /damaged|broken|defect|crack/,
    sources: ['Orders', 'Inventory', 'Policy'],
    variants: [
      {
        facts: [
          'Order 77421 marked as delivered yesterday',
          'Photo evidence required for damage claim',
          'Replacement SKU ABC-441 is in stock'
        ],
        insights: { sentiment: 'upset', risk: 'medium' },
        next_steps: [
          'Offer a replacement and explain the photo requirement.',
          'Confirm damage details and start the replacement request.'
        ]
      },
      {
        facts: [
          'Item was delivered in 2 separate boxes',
          'Return label can be issued instantly',
          'Replacement can ship today'
        ],
        insights: { sentiment: 'disappointed', risk: 'low' },
        next_steps: [
          'Arrange immediate replacement and send a return label.',
          'Confirm shipping preferences and timeline.'
        ]
      }
    ]
  },
  {
    id: 'billing_issue',
    match: /refund|chargeback|charged twice|billing|invoice/,
    sources: ['Billing', 'Policy'],
    variants: [
      {
        facts: [
          'Invoice INV-5541 shows two identical charges',
          'Most recent payment posted at 10:14 AM',
          'Refunds typically settle within 3-5 business days'
        ],
        insights: { sentiment: 'concerned', risk: 'high' },
        next_steps: [
          'Acknowledge the duplicate charge and begin refund review.',
          'Confirm the affected invoice and advise refund timeline.'
        ]
      },
      {
        facts: [
          'Pending authorization may appear twice temporarily',
          'One charge is still in pending status',
          'Dispute policy allows review within 24 hours'
        ],
        insights: { sentiment: 'confused', risk: 'medium' },
        next_steps: [
          'Explain pending authorizations and set expectations.',
          'Offer to monitor and confirm when it clears.'
        ]
      }
    ]
  },
  {
    id: 'cancellation_request',
    match: /cancel|cancellation|return/,
    sources: ['Orders', 'Policy'],
    variants: [
      {
        facts: [
          'Order 88109 is still in processing and eligible for cancel',
          'Return window is 30 days from delivery',
          'Restocking fee does not apply for unopened items'
        ],
        insights: { sentiment: 'neutral', risk: 'low' },
        next_steps: [
          'Confirm the order and proceed with cancellation.',
          'Offer alternatives if the customer wants an exchange.'
        ]
      },
      {
        facts: [
          'Order is scheduled to ship in 6 hours',
          'Cancellation can be requested until label is created',
          'Return label can be issued post-delivery'
        ],
        insights: { sentiment: 'impatient', risk: 'low' },
        next_steps: [
          'Attempt cancellation and explain cutoff timing.',
          'Provide return options if shipment has already left.'
        ]
      }
    ]
  },
  {
    id: 'account_access',
    match: /password|login|account|reset/,
    sources: ['Identity', 'Security'],
    variants: [
      {
        facts: [
          'Account shows 3 failed login attempts in the last hour',
          'Password reset link expires after 15 minutes',
          'Multi-factor authentication is enabled'
        ],
        insights: { sentiment: 'frustrated', risk: 'medium' },
        next_steps: [
          'Guide the customer through password reset.',
          'Verify identity and confirm MFA device.'
        ]
      },
      {
        facts: [
          'Recent login from a new device was detected',
          'Security lockout triggers after 5 failed attempts',
          'Recovery email is on file'
        ],
        insights: { sentiment: 'concerned', risk: 'high' },
        next_steps: [
          'Verify identity and assist with account recovery.',
          'Offer to reset security settings after access restored.'
        ]
      }
    ]
  },
  {
    id: 'general_inquiry',
    match: /.*/,
    sources: ['CRM', 'Support'],
    variants: [
      {
        facts: [
          'Customer has 2 open tickets in the last 90 days',
          'Preferred contact method is email',
          'Average resolution time is 24 hours'
        ],
        insights: { sentiment: 'neutral', risk: 'low' },
        next_steps: [
          'Summarize the request and confirm expectations.',
          'Offer to follow up via the preferred channel.'
        ]
      },
      {
        facts: [
          'Customer is a priority tier member',
          'Last contact was 8 days ago',
          'SLA for priority accounts is 4 hours'
        ],
        insights: { sentiment: 'neutral', risk: 'low' },
        next_steps: [
          'Acknowledge priority status and provide quick next steps.',
          'Offer a timeline and confirm best callback time.'
        ]
      }
    ]
  }
]

function selectScenario(text) {
  const normalized = text.toLowerCase()
  return SCENARIOS.find((scenario) => scenario.match.test(normalized)) || SCENARIOS[SCENARIOS.length - 1]
}

function hashToIndex(text, modulo) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % modulo
}

exports.handler = async (event) => {
  const detail = event.detail || {}
  const callId = detail.call_id

  if (process.env.MOCK_RETRIEVAL !== 'true') {
    // TODO: Fetch tickets and orders for the caller.
    return
  }

  const contextText = detail.segment?.text || detail.context_window?.segments?.map((item) => item.text || '').join(' ') || ''
  const scenario = SCENARIOS.find((entry) => entry.id === detail.trigger_type) || selectScenario(contextText)
  const variantIndex = hashToIndex(`${callId || ''}:${contextText}`, scenario.variants.length)
  const variant = scenario.variants[variantIndex]
  const facts = variant.facts.slice(0, 3)
  if (facts.length === 0) {
    return
  }

  await emitEvent(DETAIL_TYPES.FACTS_RETRIEVED, {
    call_id: callId,
    facts,
    sources: scenario.sources,
    insights: variant.insights,
    next_steps: variant.next_steps,
    context_snippet: detail.segment?.text || ''
  })
}
