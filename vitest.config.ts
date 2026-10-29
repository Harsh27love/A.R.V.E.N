import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts'],fileParallelism:false,maxWorkers:1,env:{DATABASE_URL:'file:./test.db',OPENROUTER_API_KEY:'',OPENAI_API_KEY:'',ENABLE_LIVE_SMS:'false'},globalSetup:['./tests/global-setup.ts'],testTimeout:15000}});
