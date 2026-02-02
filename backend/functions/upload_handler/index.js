const path = require('path')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { updateCallState } = require('../../lib/dynamo')

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

  const fileName = body.file_name || 'recording.wav'
  const ext = path.extname(fileName) || '.wav'
  const contentType = body.content_type || 'audio/wav'
  const key = `calls/${callId}/recording${ext}`
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

  await updateCallState(callId, {
    recording_s3_key: key,
    recording_content_type: contentType
  })

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      upload_url: uploadUrl,
      s3_key: key
    })
  }
}
