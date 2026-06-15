## ADDED Requirements

### Requirement: Transcript generation without model selection

The summarize form SHALL NOT expose any transcript model selector, and the client SHALL NOT send a model identifier to the backend. The backend SHALL request transcripts from the audio-transcript-service without a model parameter, allowing the service to auto-select the model internally.

#### Scenario: Form renders without a model selector

- **WHEN** a user opens the home page summarize form
- **THEN** no `转录模型` selector row is shown
- **AND** the form contains only the URL input, summary-mode selector, and the force-refresh checkbox

#### Scenario: Summarize request omits the model parameter

- **WHEN** a user submits a valid Bilibili URL
- **THEN** the `/api/summarize` request body contains no `transcriptModel` field
- **AND** the call to the audio-transcript-service targets `/api/transcribe` with no `?model=` query parameter

#### Scenario: Backend does not validate or default a model

- **WHEN** the `/api/summarize` route handles a request
- **THEN** it performs no model allowlist validation and resolves no default model
- **AND** a transcript is produced by the service's auto-selected model

### Requirement: Single ASR cache key per video

The ASR cache SHALL key transcripts by Bilibili video id alone, independent of any model.

#### Scenario: Cache key has no model suffix

- **WHEN** a transcript for a video is cached or looked up
- **THEN** the Redis key is `bilibili:asr:{bvid}` with no model component

### Requirement: Generic busy hint on service unavailability

When the transcript service returns a 503 UNAVAILABLE error, the UI SHALL show a generic retry hint that does not reference model switching.

#### Scenario: 503 error shows generic hint

- **WHEN** the summarize flow surfaces an error containing `UNAVAILABLE` and `"code":503`
- **THEN** the UI shows `转录服务繁忙，请稍后重试`
- **AND** the hint does not instruct the user to switch transcript models
