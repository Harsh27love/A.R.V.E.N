# What works, what is simulated, what comes next

## Working local prototype

| Area | Implemented behavior |
| --- | --- |
| Navigation | All ten pages, responsive sidebar, hash navigation, global search, keyboard shortcut, notifications, toast feedback, confirmation dialogs, persistent preferences. |
| SYNO Demo Mode | Seven deterministic intent families; channel selection, day thresholds, repeat intervals; persisted conversations; editable structured proposals; clarification for unsupported requests. |
| Automation Studio | React Flow graph with draggable saved positions, node configuration, conditions, recipient scope, delay, channel/message editing, seven templates, validation, draft save, approval. |
| Workflows | Create, edit, duplicate, test, activate, pause, manually run, and delete. Changes return an active workflow to draft and require approval again. |
| Engine | Manual triggers, authenticated sample events, recurring schedules, contact conditions, actual delays, queued/waiting states, cancellation, persisted logs, injected failure, and up to three retries. |
| Persistence | SQLite through Prisma. Workflow definitions are snapshotted on each run; messages and logs persist across reloads and server restarts. |
| Communications | Four channel tabs; sample incoming conversations; local outgoing message creation; selection by contact; scheduled follow-ups; cancellation; message history. |
| CRM | Add/edit/delete contacts, name/email/company search, status and tag filters, notes, consent flag, follow-up dates, interaction history, CSV import/upsert and export. |
| Analytics | Database-derived workflow, contact, message, success/failure and activity metrics; seven-day UTC chart; communication mix; latest 100 execution logs. |
| Demo reset | Confirmed transactional reset restores six contacts, six workflows, fictional conversations, sample history, chat, and preferences. Initial setup preserves existing data. |
| Hardware concept store | Five original vector illustrations, category filters, product detail URLs, browser-persisted cart, quantity controls, calculated totals, checkout preview. |
| Design | Dark responsive interface, mint/cyan/violet/blue accents, orbital animation, Motion transitions, Lucide icons, local bundled fonts, reduced-motion preference. |
| Boundaries | Loopback-only server; session token; origin/host checks; Zod validation; Prisma queries; rate/body limits; bounded runs and CSV import; external SMS consent and per-message approval. |

## Simulation and estimates

- Workflow email, SMS, WhatsApp, and notification actions create actual internal database records. They always use the local provider. Outgoing records show **Demo — Not Sent**.
- Incoming sample conversations and the original fourteen runs are seeded showcase data. Execution logs identify seeded sample history.
- A sample customer event is an explicit local test. It does not come from a connected email inbox, calendar, order system, or customer device.
- No-reply conditions use a contact's stored `lastReplyAt`, initialized by the seed. The MVP does not synchronize real replies from outside providers.
- Estimated time saved assumes five minutes per successful workflow run. It is not measured productivity or a business performance guarantee.
- Hardware designs, product specifications, and rupee prices are illustrative. Checkout creates no order, payment, reservation, or shipping obligation.
- Browser-stored hardware carts survive demo resets. Business data lives in SQLite.

## Provider integrations and verification status

**OpenRouter / NVIDIA Nemotron proposal adapter.** SYNO uses `nvidia/nemotron-3-ultra-550b-a55b` at `https://openrouter.ai/api/v1/chat/completions`, reading only the private backend `OPENROUTER_API_KEY`. The exact model connection passed a live synthetic workflow test on 29 October 2026. AI Mode uses a strict JSON schema, including numeric-string constraints for no-reply thresholds, and validates proposals again with Zod. Only supported triggers/actions are permitted, model-generated recipient IDs are cleared, and no execution tools are exposed. Provider routing requires structured-output support; no alternate model or free variant is substituted. A failed AI request creates no partial workflow or chat record. Raw provider errors and credentials are never logged or returned to the frontend. The user still reviews and approves every proposal. Only the instruction is sent externally; workflow messaging stays simulated.

**Twilio SMS adapter.** Credentials remain server-side. The integration remains Not Connected until the backend verifies an active account with Twilio. Automated workflows never send live SMS. In the Communication Hub, a single unsent SMS to a contact with recorded consent can be individually reviewed and sent by typing the last four phone digits. The backend limits this path to five messages per hour. Provider acceptance is labeled separately from confirmed delivery; a Check delivery control reads the official provider status. An ambiguous send failure becomes Delivery unconfirmed and is not automatically retried. No Twilio credentials were supplied, so live authorization, billing, and delivery were not exercised.

Provider adapter references: [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [OpenRouter error handling](https://openrouter.ai/docs/api_reference/errors-and-debugging), [Twilio Message resource](https://www.twilio.com/docs/messaging/api/message-resource).

## Incomplete / future capabilities

- Gmail OAuth, inbox synchronization, and live email sending.
- WhatsApp Business/Meta authorization, approved templates, and live WhatsApp sending.
- Google Calendar OAuth and real appointment synchronization.
- Public, authenticated, internet-accessible incoming webhooks.
- General-purpose natural-language execution, arbitrary code, branching graphs, multiple action chains, and arbitrary tool calls. The visual editor intentionally follows the supported four-step engine sequence.
- Hosted multi-user accounts, organization roles, encryption-at-rest management, and production authentication. This is a trusted, single-owner, loopback-only local app.
- A scheduler that runs while the machine/backend is off. After restart, each overdue recurring workflow runs once and then receives a new future time; missed intervals are not replayed in bulk.
- Measured ROI, real customer conversion attribution, or email open/read tracking.
- Manufacturing, validated hardware specifications, availability, fulfillment, and payments.
- Formal accessibility certification and cross-browser certification. Keyboard controls, modal focus containment, reduced-motion behavior, desktop Chrome, and mobile viewport layouts are covered by the supplied tests.

## Operational limits

- Ten contacts per workflow execution; a one-action flow; delay up to five minutes; schedule interval from one minute to seven days.
- CSV imports accept at most 100 contacts and 120 KB. Upsert is by email. Import never assumes live-message consent. Export escapes quoted fields and prefixes spreadsheet-formula payloads.
- The interface fetches the latest 200 messages and 100 executions. Database totals include all records. This is a bounded local MVP, not a paginated production CRM.
- One backend process owns the local scheduler. Multiple server processes against the same database are not supported.
- Editing an active workflow returns it to draft. Runs already created retain their approved definition snapshot and must be cancelled separately if waiting.
- The local session token changes when the backend restarts; reloading re-establishes the session. Do not expose this development server to a network or tunnel.

## Validation

`npm test` runs the deterministic parser and API/database/engine integration suite in `database/test.db`.

`npm run test:e2e` starts the frontend and backend using a separate `database/browser.db`, then checks page navigation, the guided showcase, persisted metrics, contact/message actions, the concept cart, mobile overflow, keyboard search, preferences, and reset in Chrome/Chromium. It also produces the screenshot set.

`npm run build` performs the full TypeScript check and Vite production compilation. `npm start` serves the production frontend and API from one Express process on loopback port 3001.
