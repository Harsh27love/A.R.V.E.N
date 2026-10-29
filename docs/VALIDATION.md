# Validation record

Validated locally on 29 October 2026 with Node 24 on Windows, installed Chrome, and SQLite. The OpenRouter / NVIDIA Nemotron connection was subsequently verified using the private backend key and a synthetic instruction; no external messages were sent.

| Check | Result |
| --- | --- |
| Initial setup and Prisma Client generation | Passed. SQLite schema applied and sample data seeded. Repeated setup preserves the workspace. |
| TypeScript | Passed (`npm run typecheck`; also required by the production build). |
| API, parser, engine and database integration tests | 51 tests passed, including private-environment model selection, OpenRouter client/route contracts, and sanitized error cases. Isolated `database/test.db`; provider requests use fake keys and mocks. |
| Desktop and mobile browser suite, development server | 6 scenarios passed. |
| Desktop and mobile browser suite, compiled production server | 7 scenarios passed, including the Nemotron mode selector, safe provider-error feedback, and instruction preservation after failure. |
| Production build | Passed. Pages load on demand; engine/editor and charts are separate chunks. |
| npm advisory audit after patching dependencies | Zero reported vulnerabilities. |
| Product screenshots | Five desktop captures plus a mobile overview generated and visually inspected. |
| Live OpenRouter / NVIDIA Nemotron connection | Passed: actual `POST /api/chat` returned HTTP 200 in AI Mode with a validated workflow using `nvidia/nemotron-3-ultra-550b-a55b`. The private `.env` remained byte-for-byte unchanged; no workflow was activated and no external message was sent. |
| Live Twilio authorization, billing and delivery | Not tested: no credentials supplied; seeded contacts are explicitly blocked from live sends. |

The browser scenarios cover all ten routes without runtime exceptions; the complete guided follow-up demo with exactly one added successful execution and message; persisted counts after reload; contact editing; CSV export; message creation, scheduling, and cancellation; product detail URLs; cart quantity/totals/checkout preview; mobile page overflow; keyboard search; reduced motion; preferences; and confirmed reset.

The integration suite additionally checks approval boundaries, invalid schema values, unknown intents, unconnected providers, blocked sample-contact live messages, duplicate avoidance on retries, due recurring schedules, contact reminder creation, delay resumption and cancellation, contact import/upsert, CSV formula handling, and sample reset.

The tests use separate databases and do not reset the user's development database. Browser test servers are stopped automatically at the end of each run.

Prisma 6's CLI currently prints a package-configuration deprecation notice; setup still succeeds. Vite also strips two unrecognized pure-comment annotations in a Zod dependency during production builds. Neither message is a compilation or test failure.
