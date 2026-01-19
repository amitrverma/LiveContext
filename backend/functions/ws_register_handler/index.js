const { registerConnection } = require('../../lib/connections')

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId
  const body = event.body ? JSON.parse(event.body) : {}

  if (!connectionId || body.action !== 'register' || !body.call_id) {
    return { statusCode: 400, body: 'Invalid registration' }
  }

  await registerConnection(body.call_id, connectionId)
  return { statusCode: 200, body: 'Registered' }
}
