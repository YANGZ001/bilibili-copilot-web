## 1. Flip transcript priority in summarize route

- [x] 1.1 Refactor `app/api/summarize/route.ts`: move `callTranscribeService` to the primary path (emit `PROGRESS:` events, then pipe to DeepSeek)
- [x] 1.2 Add Bilibili subtitle fetch as the catch block fallback: if `callTranscribeService` throws, call `getSubtitleForVideo` and proceed with its result
- [x] 1.3 Handle the case where `AUDIO_TRANSCRIBE_SERVICE_URL` is not set: skip transcription and go directly to Bilibili subtitle fetch

## 2. Verify behavior

- [x] 2.1 Run `docker compose up --build` and submit a video URL — confirm `PROGRESS:` events appear and summary is generated from audio transcript
- [x] 2.2 Temporarily unset `AUDIO_TRANSCRIBE_SERVICE_URL` and verify the system falls back to Bilibili subtitles without error
- [x] 2.3 Confirm that when transcription fails (simulate by pointing to a bad URL) the Bilibili subtitle fallback is used silently
