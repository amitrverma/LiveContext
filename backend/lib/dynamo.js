const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const CALL_STATE_TABLE = process.env.CALL_STATE_TABLE

async function getCallState(callId) {
  const response = await docClient.send(new GetCommand({
    TableName: CALL_STATE_TABLE,
    Key: { call_id: callId }
  }))

  return response.Item || null
}

async function putCallState(item) {
  await docClient.send(new PutCommand({
    TableName: CALL_STATE_TABLE,
    Item: item
  }))
}

async function updateCallState(callId, updates) {
  const expressions = []
  const values = {}
  const names = {}

  Object.entries(updates).forEach(([key, value]) => {
    expressions.push(`#${key} = :${key}`)
    values[`:${key}`] = value
    names[`#${key}`] = key
  })

  await docClient.send(new UpdateCommand({
    TableName: CALL_STATE_TABLE,
    Key: { call_id: callId },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
  }))
}

module.exports = {
  getCallState,
  putCallState,
  updateCallState
}
