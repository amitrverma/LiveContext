const { randomUUID } = require('crypto')
const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')
const { updateCallState } = require('../../lib/dynamo')

async function phraseNextStep(facts, contextSnippet) {
  if (process.env.MOCK_LLM === 'true') {
    return 'Acknowledge the issue and offer a resolution option.'
  }

  // TODO: Implement Bedrock or OpenAI-compatible phrasing call.
  return null
}

exports.handler = async (event) => {
  const detail = event.detail || {}
  const callId = detail.call_id
  const facts = detail.facts || []

  if (facts.length === 0) {
    return
  }

  const selectedFacts = facts.slice(0, 2)
  const nextStep = await phraseNextStep(selectedFacts, detail.context_snippet || '')

  if (!nextStep) {
    return
  }

  const card = {
    card_id: randomUUID(),
    call_id: callId,
    facts: selectedFacts,
    next_step: nextStep,
    insights: {
      sentiment: 'unknown',
      risk: 'unknown'
    },
    sources: detail.sources || []
  }

  await updateCallState(callId, { active_card_id: card.card_id })

  await emitEvent(DETAIL_TYPES.ASSIST_CARD_READY, {
    call_id: callId,
    card
  })
}
