const { TranscribeClient, StartTranscriptionJobCommand } = require('@aws-sdk/client-transcribe')
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3')
const { getCallState, updateCallState } = require('../../lib/dynamo')

const transcribeClient = new TranscribeClient({})
const s3Client = new S3Client({})
const TRANSCRIBE_MODE = process.env.TRANSCRIBE_MODE || 'streaming'
const DEFAULT_LANGUAGE = process.env.TRANSCRIBE_LANGUAGE || 'en-US'
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'wav', 'flac', 'ogg', 'amr', 'webm']

function getMediaFormat(key, contentType) {
  const ext = key?.split('.').pop()?.toLowerCase()
  if (ext && SUPPORTED_FORMATS.includes(ext)) {
    return ext
  }
  if (contentType?.includes('mpeg')) {
    return 'mp3'
  }
  if (contentType?.includes('wav')) {
    return 'wav'
  }
  if (contentType?.includes('webm')) {
    return 'webm'
  }
  return 'wav'
}

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

  if (TRANSCRIBE_MODE === 'batch') {
    const state = await getCallState(callId)
    const recordingKey = state?.recording_s3_key
    if (!recordingKey) {
      return { statusCode: 400, headers: corsHeaders, body: 'recording not uploaded yet' }
    }

    const jobName = `call-${callId}-${Date.now()}`
    const mediaFormat = getMediaFormat(recordingKey, state?.recording_content_type)
    const bucketName = process.env.S3_BUCKET
    const mediaUri = `s3://${bucketName}/${recordingKey}`

    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: recordingKey
      }))
    } catch (error) {
      console.error('recording not accessible', {
        callId,
        bucket: bucketName,
        key: recordingKey,
        error: error?.message
      })
      return { statusCode: 400, headers: corsHeaders, body: 'recording not accessible' }
    }

    await transcribeClient.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: DEFAULT_LANGUAGE,
      MediaFormat: mediaFormat,
      Media: {
        MediaFileUri: mediaUri
      },
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2
      }
    }))

    await updateCallState(callId, {
      transcribe_job_name: jobName
    })
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
