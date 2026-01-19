const EVENT_SOURCE = 'call.copilot'

const DETAIL_TYPES = {
  AUDIO_CHUNK: 'audio.chunk',
  TRANSCRIPT_PARTIAL: 'transcript.partial',
  TRANSCRIPT_FINAL: 'transcript.final',
  CONTEXT_UPDATED: 'context.updated',
  TRIGGER_FIRED: 'trigger.fired',
  FACTS_RETRIEVED: 'facts.retrieved',
  ASSIST_CARD_READY: 'assist.card.ready'
}

module.exports = {
  EVENT_SOURCE,
  DETAIL_TYPES
}
