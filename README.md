# Call Copilot POC Boilerplate

This repo provides a production-grade boilerplate for a call copilot POC. The system simulates live call assistance from a recorded audio file, using streaming transcription, rule-based triggers, and LLM phrasing.

## Architecture (high level)
- Audio playback happens in the browser using the Web Audio API
- Audio frames are streamed in real time over WebSocket
- Streaming STT emits partial and final transcripts
- Only finalized segments update a rolling context window
- Triggers evaluate the window and decide WHAT to show
- Retrieval fetches tickets and orders only
- LLM phrases HOW to present the next step
- Assist cards are pushed asynchronously over WebSocket

## Folder structure
- `frontend/` React + Vite UI (audio player, transcript, assist panel)
- `backend/` AWS Lambda functions + shared libraries
- `infra/` Serverless infrastructure template (API Gateway, DynamoDB, S3, EventBridge)

## Data models
The backend enforces these structures:
- Transcript Segment (final only)
- Context Window
- Assist Card

See `backend/lib/models.js` for definitions.

## Local frontend demo
The frontend includes a demo mode that simulates transcript and assist card events without backend connectivity.

1) Install dependencies
```
cd frontend
npm install
```
2) Run the UI in demo mode
```
VITE_DEMO_MODE=true npm run dev
```

## Frontend setup (AWS backend)
Create a `.env.local` in `frontend/`:
```
VITE_API_BASE_URL=https://<rest-api-id>.execute-api.<region>.amazonaws.com/prod
VITE_WS_URL=wss://<ws-api-id>.execute-api.<region>.amazonaws.com/prod
```
Then run:
```
cd frontend
npm run dev
```

## Backend setup (AWS)

## REST + WebSocket API
- `POST /calls` creates a new call session and returns `call_id` and `ws_url`
- `POST /calls/{call_id}/start` marks playback as started
- `POST /upload` returns a pre-signed S3 URL for the audio file
- WebSocket routes: `$connect`, `register`, `audio_chunk`

This is a serverless architecture using API Gateway (REST + WebSocket), Lambda, DynamoDB, EventBridge, and S3.

## Deploy with AWS SAM
From the repo root:
```
cd infra
sam build
sam deploy --guided
```

Parameters to set during deploy:
- `RecordingsBucketName` (must be globally unique, or leave blank to auto-generate)
- `StageName` (default: `prod`)
- `EventBusName` (default: `CallCopilotBus`)
- `CallStateTableName` (default: `CallStateTable`)
- `ConnectionsTableName` (default: `ConnectionsTable`)

After deploy, capture the stack outputs:
- `RestApiUrl` → set `VITE_API_BASE_URL` in the frontend
- `WebSocketUrl` → set `VITE_WS_URL` in the frontend

1) Install backend dependencies
```
cd backend
npm install
```
2) Deploy the infra template and functions
- Use the `infra/template.yaml` as a starting point
- Wire EventBridge rules to Lambda functions as described in the template

## Local backend invoke (optional)
Create `backend/.env` from `backend/.env.example`, then run:
```
cd backend
npm run invoke -- functions/trigger_engine/index.js
```
You can pass a JSON event file as the second argument.

## Environment variables (backend)
- `EVENT_BUS_NAME`
- `CALL_STATE_TABLE`
- `CONNECTIONS_TABLE`
- `S3_BUCKET`
- `WS_API_ENDPOINT`
- `TRANSCRIBE_MODE` (`streaming` or `batch`)
- `TRANSCRIBE_LANGUAGE` (default: `en-US`)
- `MOCK_STT`, `MOCK_TRIGGERS`, `MOCK_RETRIEVAL`, `MOCK_LLM`

## Notes
- Business logic for triggers, retrieval, and LLM phrasing is intentionally stubbed with TODOs.
- The mock flags allow you to test the pipeline without external dependencies.
- Audio playback and transcription never pause; all processing is async and event-driven.
  - In batch mode, transcription runs after the recording is uploaded to S3 and emits final segments when the job completes.
