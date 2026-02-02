const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { listConnections, removeConnection } = require('./connections')

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
  await Promise.all(connections.map(async (conn) => {
    try {
      await postToConnection(conn.connection_id, payload)
    } catch (error) {
      const statusCode = error?.$metadata?.httpStatusCode
      if (statusCode === 410 || statusCode === 403) {
        await removeConnection(callId, conn.connection_id)
        return
      }
      throw error
    }
  }))
}

module.exports = {
  broadcastToCall
}
