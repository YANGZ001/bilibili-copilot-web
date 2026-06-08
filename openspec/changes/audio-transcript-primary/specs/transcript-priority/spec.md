## ADDED Requirements

### Requirement: Audio transcript service is the primary transcript source
The system SHALL call `callTranscribeService` before attempting to fetch Bilibili subtitles. Bilibili subtitle fetch SHALL only be attempted if `callTranscribeService` throws an error.

#### Scenario: Transcription succeeds
- **WHEN** a user submits a valid Bilibili video URL for summarization
- **THEN** the system calls `callTranscribeService` and uses its result as the transcript

#### Scenario: Transcription service not configured
- **WHEN** `AUDIO_TRANSCRIBE_SERVICE_URL` is not set
- **THEN** the system skips transcription and falls back directly to the Bilibili subtitle API

#### Scenario: Transcription service fails, Bilibili subtitles available
- **WHEN** `callTranscribeService` throws an error
- **AND** `getSubtitleForVideo` returns `available: true`
- **THEN** the system proceeds with the Bilibili subtitle text without surfacing the transcription error to the user

#### Scenario: Transcription service fails, Bilibili subtitles unavailable
- **WHEN** `callTranscribeService` throws an error
- **AND** `getSubtitleForVideo` returns `available: false`
- **THEN** the system returns an error response to the client

### Requirement: Progress events are emitted during transcription
The system SHALL emit `PROGRESS:` SSE events while `callTranscribeService` is running, so the client can display transcription status.

#### Scenario: Transcription in progress
- **WHEN** `callTranscribeService` emits a `downloading`, `uploading`, or `transcribing` event
- **THEN** the server forwards a corresponding `PROGRESS:` line to the client stream
