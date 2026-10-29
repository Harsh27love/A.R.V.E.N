import 'dotenv/config';
import { AI_BASE_URL, getAIModel, AI_PROVIDER, AIProviderError, testAIConnection } from '../backend/integrations/openrouter';

try {
  const result = await testAIConnection();
  console.log(JSON.stringify({ ...result, baseURL: AI_BASE_URL, externalMessaging: 'disabled by this test' }, null, 2));
} catch (error) {
  const failure = error instanceof AIProviderError ? error : new AIProviderError('AI_TEST_FAILED', 'The connection test could not complete. Check the private backend configuration.');
  console.error(JSON.stringify({ ok: false, provider: AI_PROVIDER, baseURL: AI_BASE_URL, model: getAIModel(), code: failure.code, error: failure.message }, null, 2));
  process.exitCode = 1;
}
