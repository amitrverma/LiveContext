const demoTranscript = [
  { delayMs: 800, speaker: 'CUSTOMER', text: 'Hi, I am calling about my recent order.' },
  { delayMs: 1400, speaker: 'AGENT', text: 'Sure, can you share the order number?' },
  { delayMs: 1600, speaker: 'CUSTOMER', text: 'It is 98342, the delivery was late.' },
  { delayMs: 1900, speaker: 'AGENT', text: 'Let me check that for you.' },
  { delayMs: 1700, speaker: 'CUSTOMER', text: 'This is the second time it happened.' }
]

const demoAssistCards = [
  {
    delayMs: 2300,
    card: {
      card_id: 'demo-card-1',
      call_id: 'demo',
      facts: ['Ticket #1123 is open for late delivery', 'Order 98342 shipped 3 days late'],
      next_step: 'Acknowledge the delay and offer expedited replacement options.',
      insights: { sentiment: 'frustrated', risk: 'medium' },
      sources: ['Tickets', 'Orders']
    }
  }
]

export function startDemoStream(handlers) {
  const timers = []

  let elapsed = 0
  demoTranscript.forEach((segment) => {
    elapsed += segment.delayMs
    timers.push(
      setTimeout(() => {
        handlers.onTranscriptPartial?.(segment.text)
        setTimeout(() => handlers.onTranscriptFinal?.(segment), 400)
      }, elapsed)
    )
  })

  demoAssistCards.forEach((entry) => {
    timers.push(
      setTimeout(() => handlers.onAssistCard?.(entry.card), entry.delayMs)
    )
  })

  return () => timers.forEach(clearTimeout)
}
