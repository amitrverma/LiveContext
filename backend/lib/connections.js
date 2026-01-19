const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb')

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE

async function registerConnection(callId, connectionId) {
  await docClient.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      call_id: callId,
      connection_id: connectionId
    }
  }))
}

async function removeConnection(callId, connectionId) {
  await docClient.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: {
      call_id: callId,
      connection_id: connectionId
    }
  }))
}

async function listConnections(callId) {
  const response = await docClient.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    KeyConditionExpression: 'call_id = :callId',
    ExpressionAttributeValues: {
      ':callId': callId
    }
  }))

  return response.Items || []
}

module.exports = {
  registerConnection,
  removeConnection,
  listConnections
}
