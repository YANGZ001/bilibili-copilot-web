# Todo

## Automated tests for security-hardening feature

No test framework is installed. Requires adding Vitest (or Jest) to devDependencies and a minimal config before writing the files below.

### Test files to create (scenarios defined in `docs/security-hardening/tests.md`)

- [ ] `lib/__tests__/streamSSE.test.ts` — buffer handling, `[DONE]` skip, partial lines, empty lines
- [ ] `lib/__tests__/llm.test.ts` — env var precedence, trailing-slash strip, model default
- [ ] `lib/db/__tests__/sessions.test.ts` — `createSession`/`getSession` roundtrip with `subtitle_text`; 14-day expiry cutoff
- [ ] `hooks/__tests__/useSession.test.ts` — `[user, assistant, user, assistant]` split; no-assistant guard; 410/404 branching
