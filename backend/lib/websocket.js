const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { listConnections } = require('./connections')

function createClient() {
  return new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_API_ENDPOINT
  })
}

async function postToConnection(connectionId, payload) {
  const client = createClient()
  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: Buffer.from(JSON.stringify(payload))
  })
  await client.send(command)
}

async function broadcastToCall(callId, payload) {
  const connections = await listConnections(callId)
  await Promise.all(connections.map((conn) => postToConnection(conn.connection_id, payload)))
}

module.exports = {
  broadcastToCall
}
