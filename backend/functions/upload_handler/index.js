const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const client = new S3Client({})

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
}

exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {}
  const callId = body.call_id

  if (!callId) {
    return { statusCode: 400, headers: corsHeaders, body: 'call_id is required' }
  }

  const key = `calls/${callId}/recording.wav`
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: 'audio/wav'
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      upload_url: uploadUrl,
      s3_key: key
    })
  }
}
