const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge')
const { EVENT_SOURCE } = require('./constants')

const client = new EventBridgeClient({})

async function emitEvent(detailType, detail) {
  const eventBusName = process.env.EVENT_BUS_NAME
  const command = new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: EVENT_SOURCE,
        DetailType: detailType,
        Detail: JSON.stringify(detail)
      }
    ]
  })

  await client.send(command)
}

module.exports = { emitEvent }
