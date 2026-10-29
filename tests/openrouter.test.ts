import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AI_BASE_URL, AI_MODEL, AIProviderError, isAIConfigured, proposeWithAI, testAIConnection } from '../backend/integrations/openrouter';
import { templates } from '../shared/schema';
import { createApp } from '../backend/app';
import { db } from '../backend/db';
import { seedDemo } from '../database/seed';

const testKey = 'openrouter-test-placeholder-not-a-credential';
const workflow = () => ({ name: templates[0].name, description: templates[0].description, definition: structuredClone(templates[0].definition) });
const result = () => ({ content: 'Review this proposed follow-up. Nothing has been sent or activated.', proposal: workflow() });
const completion = (value: unknown = result(), extra: Record<string, unknown> = {}) => ({
  model: AI_MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }], ...extra,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', testKey);
  vi.stubEnv('OPENROUTER_BASE_URL', AI_BASE_URL);
  vi.stubEnv('OPENROUTER_MODEL', AI_MODEL);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('OpenRouter Nemotron adapter', () => {
  it('uses the exact endpoint and model, strict structured output, and backend-only credentials', async () => {
    fetchMock.mockResolvedValue(json(completion()));
    const output = await proposeWithAI('Follow up after three days.');
    expect(output.proposal?.definition.condition.value).toBe('3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${testKey}` });
    expect(init?.redirect).toBe('error');
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe(AI_MODEL);
    expect(body.provider.require_parameters).toBe(true);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.models).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(init?.body).not.toContain(testKey);
  });

  it('does not use a legacy OpenAI key or contact another host', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'legacy-placeholder');
    expect(isAIConfigured()).toBe(false);
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('OPENROUTER_API_KEY', testKey);
    vi.stubEnv('OPENROUTER_BASE_URL', 'https://other-host.example/api/v1');
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_CONFIGURATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the explicitly configured model instead of hardcoding or substituting it', async () => {
    const configuredModel = 'example/model-selected-in-private-env';
    vi.stubEnv('OPENROUTER_MODEL', configuredModel);
    vi.stubEnv('OPENROUTER_BASE_URL', `${AI_BASE_URL}/`);
    fetchMock.mockResolvedValue(json(completion(result(), { model: configuredModel })));
    await proposeWithAI('Follow up.');
    expect(fetchMock.mock.calls[0][0]).toBe(`${AI_BASE_URL}/chat/completions`);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).model).toBe(configuredModel);
  });

  it('rejects malformed model settings before sending credentials', async () => {
    vi.stubEnv('OPENROUTER_MODEL', 'not-a-valid-provider-model');
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_CONFIGURATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'AI_AUTHENTICATION_FAILED', 502], [402, 'AI_CREDITS_REQUIRED', 503],
    [403, 'AI_ACCESS_DENIED', 502], [404, 'AI_MODEL_UNAVAILABLE', 503],
    [429, 'AI_RATE_LIMITED', 429], [400, 'AI_REQUEST_REJECTED', 502],
    [422, 'AI_REQUEST_REJECTED', 502], [503, 'AI_PROVIDER_UNAVAILABLE', 503],
    [504, 'AI_TIMEOUT', 504],
  ])('maps provider HTTP %i to a safe %s error', async (status, code, localStatus) => {
    fetchMock.mockResolvedValue(json({ error: { code: status, message: `Sensitive upstream detail: ${testKey}`, metadata: { raw: testKey } } }, status));
    const error = await proposeWithAI('Follow up.').catch(error => error as AIProviderError);
    expect(error).toBeInstanceOf(AIProviderError);
    if (!(error instanceof AIProviderError)) throw new Error('Expected a sanitized AI provider error.');
    expect(error).toMatchObject({ code, status: localStatus });
    expect(JSON.stringify(error)).not.toContain(testKey);
    expect(error.message).not.toContain(testKey);
  });

  it('handles provider errors returned inside HTTP 200', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 404, message: 'No endpoints available.' } }));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_MODEL_UNAVAILABLE' });
  });

  it('sanitizes network and timeout exceptions', async () => {
    fetchMock.mockRejectedValue(new TypeError(`Sensitive header: ${testKey}`));
    const error = await proposeWithAI('Follow up.').catch(error => error as AIProviderError);
    if (!(error instanceof AIProviderError)) throw new Error('Expected a sanitized AI network error.');
    expect(error.code).toBe('AI_NETWORK_ERROR');
    expect(error.message).not.toContain(testKey);
    fetchMock.mockRejectedValue(Object.assign(new Error(testKey), { name: 'TimeoutError' }));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  });

  it('rejects malformed, empty, truncated, or refused model output', async () => {
    fetchMock.mockResolvedValue(new Response('<html>invalid</html>', { status: 200 }));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    fetchMock.mockResolvedValue(json(completion(null, { choices: [{ message: { content: '{invalid' } }] })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    fetchMock.mockResolvedValue(json(completion(null, { choices: [{ message: { content: '' } }] })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
    fetchMock.mockResolvedValue(json(completion(null, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_RESPONSE_TRUNCATED' });
    fetchMock.mockResolvedValue(json(completion(null, { choices: [{ message: { refusal: 'Request refused.' } }] })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_REQUEST_REFUSED' });
  });

  it('rejects invalid day conditions and unsupported actions', async () => {
    const invalid = result(); invalid.proposal.definition.condition.value = '3 days';
    fetchMock.mockResolvedValue(json(completion(invalid)));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_INVALID_PROPOSAL' });
    const unsafe = { ...result(), proposal: { ...workflow(), definition: { ...workflow().definition, action: { channel: 'shell', subject: 'Unsafe', body: 'Run code' } } } };
    fetchMock.mockResolvedValue(json(completion(unsafe)));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_INVALID_PROPOSAL' });
  });

  it('rejects tool calls and an unexpected model without executing anything', async () => {
    fetchMock.mockResolvedValue(json(completion(null, { choices: [{ message: { content: '{}', tool_calls: [{}] } }] })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_UNEXPECTED_TOOL_CALL' });
    fetchMock.mockResolvedValue(json(completion(result(), { model: 'another-model' })));
    await expect(proposeWithAI('Follow up.')).rejects.toMatchObject({ code: 'AI_MODEL_MISMATCH' });
  });

  it('clears model-suggested recipients and allows clarification', async () => {
    const value = result(); value.proposal.definition.contactIds = ['untrusted-model-recipient'];
    fetchMock.mockResolvedValue(json(completion(value)));
    expect((await proposeWithAI('Follow up.')).proposal?.definition.contactIds).toEqual([]);
    fetchMock.mockResolvedValue(json(completion({ content: 'What should trigger the workflow?', proposal: null })));
    expect((await proposeWithAI('Something unclear.')).proposal).toBeNull();
  });

  it('requires a validated workflow to report a successful connection test', async () => {
    fetchMock.mockResolvedValue(json(completion()));
    expect(await testAIConnection()).toMatchObject({ ok: true, provider: 'OpenRouter', model: AI_MODEL, proposalValidated: true });
    fetchMock.mockResolvedValue(json(completion({ content: 'Please clarify.', proposal: null })));
    await expect(testAIConnection()).rejects.toMatchObject({ code: 'AI_CONNECTION_TEST_FAILED' });
  });
});

describe('SYNO API integration', () => {
  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => { await seedDemo(); });
  afterAll(async () => { await db.$disconnect(); });
  const call = (path: string, body: unknown) => { const app = createApp(); return request(app).post(`/api${path}`).set('x-arven-session', app.locals.token).send(body as object); };

  it('exposes only safe provider metadata to the frontend', async () => {
    const app = createApp();
    const state = await request(app).get('/api/state').set('x-arven-session', app.locals.token);
    expect(state.body).toMatchObject({ aiConfigured: true, aiProvider: 'OpenRouter', aiModel: AI_MODEL });
    expect(JSON.stringify(state.body)).not.toContain(testKey);
    expect(state.body.OPENROUTER_API_KEY).toBeUndefined();
  });

  it('persists a successful AI chat as a proposal without executing or activating it', async () => {
    fetchMock.mockResolvedValue(json(completion()));
    const workflows = await db.workflow.count(), messages = await db.message.count();
    const response = await call('/chat', { prompt: 'Follow up after three days.', mode: 'ai' });
    expect(response.status).toBe(200);
    expect(response.body.messages[1].proposal.definition.event).toBe('no_reply');
    expect(await db.chatMessage.count()).toBe(3);
    expect(await db.workflow.count()).toBe(workflows);
    expect(await db.message.count()).toBe(messages);
  });

  it('returns actionable unavailable-model errors and never persists a failed proposal', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 404, message: testKey } }, 404));
    const response = await call('/chat', { prompt: 'Follow up.', mode: 'ai' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_MODEL_UNAVAILABLE');
    expect(response.body.error).toContain(AI_MODEL);
    expect(JSON.stringify(response.body)).not.toContain(testKey);
    expect(await db.chatMessage.count()).toBe(1);
  });

  it('tests the same real client through an authenticated connection-check endpoint', async () => {
    fetchMock.mockResolvedValue(json(completion()));
    const response = await call('/ai/test', {});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, model: AI_MODEL, proposalValidated: true });
    expect(JSON.stringify(response.body)).not.toContain(testKey);
    expect(await db.chatMessage.count()).toBe(1);
  });
});
