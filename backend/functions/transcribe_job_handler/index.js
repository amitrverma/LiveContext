const { TranscribeClient, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe')
const { emitEvent } = require('../../lib/events')
const { DETAIL_TYPES } = require('../../lib/constants')

const client = new TranscribeClient({})

function parseCallId(jobName) {
  const match = /^call-(.+)-\d+$/.exec(jobName || '')
  return match ? match[1] : null
}

function buildWordList(items) {
  const words = []
  items.forEach((item) => {
    if (item.type === 'pronunciation') {
      words.push({
        start: Number(item.start_time || 0),
        end: Number(item.end_time || 0),
        content: item.alternatives?.[0]?.content || ''
      })
    } else if (item.type === 'punctuation' && words.length > 0) {
      words[words.length - 1].content += item.alternatives?.[0]?.content || ''
    }
  })
  return words
}

function buildSegments(transcriptJson, callId) {
  const results = transcriptJson.results || {}
  const items = results.items || []
  const words = buildWordList(items)
  const speakerSegments = results.speaker_labels?.segments || []

  if (speakerSegments.length === 0) {
    const text = (results.transcripts?.[0]?.transcript || '').trim()
    if (!text) {
      return []
    }
    const end = words.length ? words[words.length - 1].end : 0
    return [{
      call_id: callId,
      speaker: 'SPEAKER_0',
      text,
      end_time: end
    }]
  }

  return speakerSegments.map((segment) => {
    const start = Number(segment.start_time || 0)
    const end = Number(segment.end_time || 0)
    const segmentWords = words.filter((word) => word.start >= start && word.end <= end)
    const text = segmentWords.map((word) => word.content).join(' ').trim()
    return {
      call_id: callId,
      speaker: segment.speaker_label || 'SPEAKER_0',
      text,
      end_time: end
    }
  }).filter((segment) => segment.text)
}

async function fetchTranscript(uri) {
  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`)
  }
  return response.json()
}

exports.handler = async (event) => {
  console.log('transcribe_job_handler invoked', {
    detailType: event['detail-type'],
    source: event.source
  })
  const detail = event.detail || {}
  const status = detail.TranscriptionJobStatus
  if (status !== 'COMPLETED') {
    console.log('transcribe job not completed', { status })
    return
  }

  const jobName = detail.TranscriptionJobName
  const callId = parseCallId(jobName)
  if (!callId) {
    console.warn('unable to parse call id', { jobName })
    return
  }

  const response = await client.send(new GetTranscriptionJobCommand({
    TranscriptionJobName: jobName
  }))

  const transcriptUri = response.TranscriptionJob?.Transcript?.TranscriptFileUri
  if (!transcriptUri) {
    console.warn('missing transcript uri', { jobName })
    return
  }

  console.log('fetching transcript', { jobName, callId })
  const transcriptJson = await fetchTranscript(transcriptUri)
  const segments = buildSegments(transcriptJson, callId)
  console.log('built segments', { jobName, callId, count: segments.length })

  for (const segment of segments) {
    console.log('emitting transcript.final', { callId, end_time: segment.end_time })
    await emitEvent(DETAIL_TYPES.TRANSCRIPT_FINAL, {
      call_id: callId,
      segment
    })
  }
}
