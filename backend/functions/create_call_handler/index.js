const { randomUUID } = require('crypto')
const { putCallState } = require('../../lib/dynamo')

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
}

exports.handler = async () => {
  const callId = randomUUID()

  await putCallState({
    call_id: callId,
    created_at: Date.now(),
    window_seconds: 15,
    context_window: { call_id: callId, window_seconds: 15, segments: [] }
  })

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      call_id: callId,
      ws_url: process.env.WS_URL || null
    })
  }
}
