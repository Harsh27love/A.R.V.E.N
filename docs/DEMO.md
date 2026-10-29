# A.R.V.E.N. founder showcase

The demonstration works without credentials or paid services. Seeded customer identities and conversations are fictional. Every workflow message is simulated, even when AI Mode is configured.

## Before recording

1. Run `npm run setup` and `npm run dev` from the project directory.
2. Open <http://127.0.0.1:5173> in Chrome. Use a 1440×1000 or larger browser window and 100% zoom.
3. In Settings, choose **Reset demo data**, then confirm. Reset replaces local business data, conversations, workflow history, and preferences.
4. Leave the backend running. Avoid editing source files during recording because development hot reload can interrupt an open form. For a recording without hot reload, use `npm run build`, then `npm start`, and open <http://127.0.0.1:3001>.
5. Verify the top bar shows **Demo Mode**. An AI provider is optional; use the local parser for a repeatable pitch.

## The guided path

1. On Overview, click **Explore the demo** or **Demo Mode** in the top bar.
2. Read the scenario: Aarav asked a small shop for a quote four days ago; the shopkeeper got busy.
3. Click **Start the showcase**. SYNO opens with:

   > Remind customers who haven't replied in three days.

4. Click the send arrow. SYNO identifies the no-reply event, a three-day condition, and an email action. It creates a proposal; no workflow has been activated.
5. Click **Review in Studio**. The guide selects Aarav as the recipient. The graph shows **Trigger → Condition → Delay → Action**. Click nodes to inspect or edit settings. Dragging nodes changes the saved layout.
6. Click **Review & activate**. Inspect the exact recipient, timing, subject, and message. Click **Approve & activate**.
7. In the guide bar, click **Trigger sample event**. This targets only the new workflow and Aarav. The backend records an execution and a simulated message in SQLite.
8. Inspect the execution log. It explicitly says **Demo — Not Sent** and confirms that no external delivery was attempted.
9. Close the log and click **View message & finish**. The Communication Hub shows the personalized message to Aarav and its simulated status.
10. Open Overview or Analytics. Successful runs and outgoing messages have each increased by one; active workflows have increased by one. Time saved is explicitly an estimate.
11. Reload the browser to demonstrate persistence. Use Reset demo data to repeat the same pitch.

The original seeded workspace has six contacts, six workflows, fourteen successful sample runs, fourteen outgoing demo messages, and four incoming sample messages. The no-credential showcase adds one workflow and one successful run.

## Suggested two-minute screen recording

| Time | Screen | What to say or show |
| --- | --- | --- |
| 0:00–0:15 | Overview | “Small businesses lose time to the everyday. Don’t Just Ask AI. Let AI Get It Done.” Point out prototype and demo labels. |
| 0:15–0:35 | SYNO | Introduce the busy shopkeeper and submit the exact follow-up instruction. |
| 0:35–0:55 | Automation Studio | Show the generated trigger, condition, recipient, and editable message. |
| 0:55–1:10 | Approval and execution log | Approve; trigger the sample event; show the persistent trace and simulation notice. |
| 1:10–1:25 | Communication Hub | Show the personalized follow-up marked “Demo — Not Sent.” |
| 1:25–1:40 | Analytics | Show actual local counts increasing. Explain the time-saved estimate. |
| 1:40–1:55 | Hardware Store | Show a concept detail, cart quantity, total, and checkout preview. Say clearly that hardware is a future concept. |
| 1:55–2:00 | Overview | Return to the core promise: less busywork, more time for the business. |

## Five recommended screenshots

Browser tests generate these actual product captures in `docs/screenshots/`:

1. **01-overview.png** — orbital SYNO hero, live local metrics, activity chart, and workflows.
2. **02-syno-proposal.png** — natural-language instruction and structured workflow proposal.
3. **03-automation-studio.png** — four connected nodes, editable message, and guided event control.
4. **04-communication-hub.png** — personalized customer follow-up, clearly labeled as a simulation.
5. **05-concept-store.png** — illustrated future hardware with concept notices and illustrative prices.

`mobile-overview.png` is an additional responsive capture. These images can be regenerated with `npm run test:e2e`; tests use a separate browser database.

## Show recovery, if asked

In Automation Studio, enable **Simulate failure**, then **Test locally**. The log records a failure without creating a message. Click **Retry execution** to recover using the same execution record. To demonstrate a cancellable delay, click the Delay node, enter 30 seconds, test, then cancel from the execution log.

## Other supported SYNO instructions

- “Send appointment reminders by SMS.”
- “Notify me when a new lead arrives.”
- “Schedule a WhatsApp message every day.”
- “Send WhatsApp notifications when order status changes.”
- “Give me a daily business summary.”
- “Route customer enquiries to my team.”

Unsupported instructions ask for clarification. The deterministic parser handles supported intent families and limited channel/day/interval extraction; it does not understand arbitrary dates, complex logic, or general business instructions.
