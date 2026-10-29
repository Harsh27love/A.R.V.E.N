import 'dotenv/config';
import { z } from 'zod';
import { workflowSchema } from '../../shared/schema';

// Public identifiers only. Secrets are resolved inside this backend module.
export const AI_BASE_URL = 'https://openrouter.ai/api/v1';
export const AI_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
export const AI_PROVIDER = 'OpenRouter';
export const isAIConfigured = () => Boolean(process.env.OPENROUTER_API_KEY?.trim());
const modelSchema = z.string().max(200).regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i);
const requestedModel = () => process.env.OPENROUTER_MODEL?.trim() || AI_MODEL;
// Public metadata must not echo an accidentally misconfigured secret value.
export const getAIModel = () => modelSchema.safeParse(requestedModel()).success ? requestedModel() : AI_MODEL;

export class AIProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = 'AIProviderError';
  }
}

function configuration() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AIProviderError('AI_NOT_CONFIGURED', 'SYNO AI Mode requires OPENROUTER_API_KEY in the private backend .env file. Demo Mode remains available.', 503);
  const baseURL = (process.env.OPENROUTER_BASE_URL?.trim() || AI_BASE_URL).replace(/\/+$/, '');
  if (baseURL !== AI_BASE_URL) throw new AIProviderError('AI_CONFIGURATION_ERROR', `OPENROUTER_BASE_URL must be ${AI_BASE_URL}. The API key will not be sent to another host.`, 503);
  const model = requestedModel();
  if (!modelSchema.safeParse(model).success) throw new AIProviderError('AI_CONFIGURATION_ERROR', 'OPENROUTER_MODEL must be a valid OpenRouter provider/model identifier. Check the private backend .env file.', 503);
  return { key, baseURL, model };
}

const resultSchema = z.object({ content: z.string().trim().min(1).max(6000), proposal: workflowSchema.nullable() }).strict();
const string = { type: 'string' };
const schema = {
  type: 'object', additionalProperties: false, required: ['content', 'proposal'],
  properties: {
    content: { ...string, minLength: 1, maxLength: 6000 },
    proposal: { anyOf: [{ type: 'null' }, {
      type: 'object', additionalProperties: false, required: ['name', 'description', 'definition'],
      properties: {
        name: { ...string, minLength: 2, maxLength: 100 }, description: { ...string, maxLength: 500 },
        definition: {
          type: 'object', additionalProperties: false,
          required: ['trigger', 'event', 'condition', 'delaySeconds', 'scheduleMinutes', 'contactIds', 'action'],
          properties: {
            trigger: { ...string, enum: ['manual', 'schedule', 'customer_event'] },
            event: { ...string, enum: ['no_reply', 'appointment', 'lead', 'scheduled', 'order', 'daily', 'enquiry'] },
            condition: { anyOf: [
              { type: 'object', additionalProperties: false, required: ['field', 'value'], properties: {
                field: { ...string, enum: ['any', 'status', 'tag'] }, value: { ...string, maxLength: 80 },
              } },
              { type: 'object', additionalProperties: false, required: ['field', 'value'], properties: {
                field: { ...string, enum: ['no_reply'] }, value: { ...string, pattern: '^(?:[1-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9]|36[0-5])$' },
              } },
            ] },
            delaySeconds: { type: 'integer', minimum: 0, maximum: 300 },
            scheduleMinutes: { type: 'integer', minimum: 1, maximum: 10080 },
            contactIds: { type: 'array', maxItems: 0, items: string },
            action: { type: 'object', additionalProperties: false, required: ['channel', 'subject', 'body'], properties: {
              channel: { ...string, enum: ['email', 'sms', 'whatsapp', 'notification'] },
              subject: { ...string, minLength: 1, maxLength: 180 }, body: { ...string, minLength: 1, maxLength: 3000 },
            } },
          },
        },
      },
    }] },
  },
};

function providerError(status: number, model: string): AIProviderError {
  switch (status) {
    case 401: return new AIProviderError('AI_AUTHENTICATION_FAILED', 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in the private .env file and restart the backend.');
    case 402: return new AIProviderError('AI_CREDITS_REQUIRED', `OpenRouter requires sufficient credits to use ${model}. Check the account balance or key spending limit. No alternate model was used.`, 503);
    case 403: return new AIProviderError('AI_ACCESS_DENIED', 'OpenRouter denied this request. Check the API key permissions, model access, and account policies.');
    case 404: return new AIProviderError('AI_MODEL_UNAVAILABLE', `OpenRouter has no available endpoint for ${model} with the required structured-output support. Try again later; no alternate model was used.`, 503);
    case 408: case 504: return new AIProviderError('AI_TIMEOUT', 'The OpenRouter model timed out. Try again or use Demo Mode. No workflow was created or activated.', 504);
    case 429: return new AIProviderError('AI_RATE_LIMITED', 'OpenRouter is rate-limiting this key or model. Wait before retrying, or use Demo Mode.', 429);
    case 400: case 422: return new AIProviderError('AI_REQUEST_REJECTED', 'OpenRouter could not accept the structured workflow request. The selected model must support strict JSON-schema outputs; no less restrictive fallback was used.');
    default: return new AIProviderError('AI_PROVIDER_UNAVAILABLE', `OpenRouter could not complete the request for ${model}. Try again later or use Demo Mode.`, 503);
  }
}

export async function proposeWithAI(prompt: string) {
  const { key, baseURL, model } = configuration();
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-OpenRouter-Title': 'A.R.V.E.N. SYNO' },
      body: JSON.stringify({
        model, stream: false, max_tokens: 1800, temperature: 0.2,
        reasoning: { enabled: false }, provider: { require_parameters: true },
        messages: [
          { role: 'system', content: 'You are SYNO, a business workflow planner powered by NVIDIA Nemotron. Create a proposal only, never execute an action or claim a message was sent. Supported intents: follow-up, appointment, lead alert, scheduled message, order update, daily summary, enquiry routing. If unclear or unsupported, set proposal to null and ask for clarification. Emit exactly the JSON schema. contactIds must always be empty: recipients are selected locally by the user. Use {{name}}, {{company}}, {{summary}} for personalization. Defaults: zero delay and 1440-minute repeat interval. For a follow-up use condition {"field":"no_reply","value":"3"}. The value is a DIGIT STRING from "1" to "365", never a number, phrase, duration, or unit. Propose only one supported action. Every resulting workflow action is a local simulation and must be reviewed and approved by the user. Never emit tool calls, arbitrary code, secrets, or requests to external services.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'workflow_proposal', strict: true, schema } },
      }),
    });
    try { payload = await response.json(); }
    catch { if (!response.ok) throw providerError(response.status, model); throw new AIProviderError('AI_INVALID_RESPONSE', 'OpenRouter returned an unreadable response. No workflow was created. Try again or use Demo Mode.'); }
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw providerError(504, model);
    // Never relay fetch exceptions, raw provider payloads, headers, or credentials.
    throw new AIProviderError('AI_NETWORK_ERROR', 'The backend could not reach OpenRouter. Check network access and try again. Demo Mode remains available.', 503);
  }
  const envelope = z.object({
    error: z.object({ code: z.union([z.number(), z.string()]).optional() }).passthrough().optional(),
    model: z.string().optional(),
    choices: z.array(z.object({
      finish_reason: z.string().nullable().optional(),
      message: z.object({ content: z.string().nullable().optional(), refusal: z.string().nullable().optional(), tool_calls: z.array(z.unknown()).optional() }).passthrough(),
    }).passthrough()).optional(),
  }).passthrough().safeParse(payload);
  if (!response.ok) throw providerError(response.status, model);
  if (!envelope.success) throw new AIProviderError('AI_INVALID_RESPONSE', 'OpenRouter returned an invalid completion envelope. No workflow was created.');
  const data = envelope.data;
  if (data.error) throw providerError(Number(data.error.code) || 503, model);
  if (data.model && data.model !== model) throw new AIProviderError('AI_MODEL_MISMATCH', 'The provider returned a different model identifier. SYNO rejected the result instead of silently substituting a model.');
  const choice = data.choices?.[0];
  if (choice?.message.tool_calls?.length) throw new AIProviderError('AI_UNEXPECTED_TOOL_CALL', 'The model returned an unsupported tool call. Nothing was executed. Try a clearer instruction.');
  if (choice?.message.refusal || choice?.finish_reason === 'content_filter') throw new AIProviderError('AI_REQUEST_REFUSED', 'The model could not propose that workflow. Clarify the instruction or use one of the supported examples.');
  if (choice?.finish_reason === 'length') throw new AIProviderError('AI_RESPONSE_TRUNCATED', 'The model response reached its output limit. No partial workflow was accepted. Try a shorter, single-action instruction.');
  const raw = choice?.message.content;
  if (!raw?.trim() || raw.length > 30000) throw new AIProviderError('AI_EMPTY_RESPONSE', 'The model returned no usable workflow response. Try again or use Demo Mode.');
  let decoded: unknown;
  try { decoded = JSON.parse(raw); }
  catch { throw new AIProviderError('AI_INVALID_RESPONSE', 'The model returned malformed JSON. No workflow was created or activated. Try again or use Demo Mode.'); }
  const parsed = resultSchema.safeParse(decoded);
  if (!parsed.success) throw new AIProviderError('AI_INVALID_PROPOSAL', 'The model response failed workflow validation. No workflow was created or activated. Try a supported instruction.');
  if (parsed.data.proposal) parsed.data.proposal.definition.contactIds = [];
  return parsed.data;
}

export async function testAIConnection() {
  const result = await proposeWithAI('Send a follow-up email to customers who have not replied in three days.');
  if (!result.proposal) throw new AIProviderError('AI_CONNECTION_TEST_FAILED', 'OpenRouter responded, but the model did not produce a valid workflow for the supported connection test.');
  return { ok: true, provider: AI_PROVIDER, model: getAIModel(), proposalValidated: true, checkedAt: new Date().toISOString() };
}
