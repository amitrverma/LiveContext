const { updateCallState } = require('../../lib/dynamo')

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
}

exports.handler = async (event) => {
  const callId = event.pathParameters?.call_id || event.pathParameters?.callId

  if (!callId) {
    return { statusCode: 400, headers: corsHeaders, body: 'call_id is required' }
  }

  await updateCallState(callId, {
    status: 'started',
    started_at: Date.now()
  })

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ call_id: callId, status: 'started' })
  }
}
