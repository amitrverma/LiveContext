# Architecture Diagram

```mermaid
flowchart LR
  UI[Browser UI]
  APIRest[API Gateway REST]
  APIWs[API Gateway WebSocket]
  EB[EventBridge Bus]
  S3[S3 Recordings/Transcripts]
  DDB[DynamoDB Call State/Connections]
  Transcribe[Amazon Transcribe]

  UI -->|POST /calls| APIRest
  UI -->|POST /upload| APIRest
  UI -->|POST /calls/{id}/start| APIRest
  UI -->|WS register/audio_chunk| APIWs

  APIRest -->|create_call| CreateCall[Lambda: create_call_handler]
  APIRest -->|upload| Upload[Lambda: upload_handler]
  APIRest -->|start_call| StartCall[Lambda: start_call_handler]

  CreateCall --> DDB
  Upload --> S3
  Upload --> DDB
  StartCall --> DDB
  StartCall -->|batch job| Transcribe

  APIWs -->|audio_chunk| AudioStream[Lambda: audio_stream_handler]
  APIWs -->|register| WsRegister[Lambda: ws_register_handler]

  AudioStream -->|emit audio.chunk| EB
  WsRegister --> DDB

  EB -->|audio.chunk| STTStream[Lambda: stt_stream_handler]
  EB -->|transcript.partial| WsDispatch[Lambda: ws_dispatcher]
  EB -->|transcript.final| Context[Lambda: context_engine]
  EB -->|transcript.final| WsDispatch
  EB -->|context.updated| Trigger[Lambda: trigger_engine]
  EB -->|trigger.fired| Retrieval[Lambda: retrieval_service]
  EB -->|facts.retrieved| LLM[Lambda: llm_phrasing_service]
  EB -->|assist.card.ready| WsDispatch

  STTStream -->|emit transcript.*| EB
  Context --> DDB
  Context -->|emit context.updated| EB
  Trigger -->|emit trigger.fired| EB
  Retrieval -->|emit facts.retrieved| EB
  LLM -->|emit assist.card.ready| EB
  WsDispatch -->|WS messages| APIWs --> UI

  Transcribe -->|Job State Change (COMPLETED)| EB
  EB -->|Transcribe Job State Change| TranscribeJob[Lambda: transcribe_job_handler]
  TranscribeJob -->|emit transcript.final| EB
```

## Event Payloads (app-emitted)

- `audio.chunk`
  - `{ call_id, sequence, audio_base64, sample_rate, channels, received_at }`
- `transcript.partial`
  - `{ call_id, text, speaker }`
- `transcript.final`
  - `{ call_id, segment: { call_id, speaker, text, end_time } }`
- `context.updated`
  - `{ call_id, context_window, segment }`
- `trigger.fired`
  - `{ call_id, trigger_type, segment, context_window }`
- `facts.retrieved`
  - `{ call_id, facts[], sources[], context_snippet }`
- `assist.card.ready`
  - `{ call_id, card: { card_id, call_id, facts[], next_step, insights, sources[] } }`

## AWS-Emitted Event (batch mode)

- `source`: `aws.transcribe`
- `detail-type`: `Transcribe Job State Change`
- `detail`: includes `TranscriptionJobName`, `TranscriptionJobStatus`
