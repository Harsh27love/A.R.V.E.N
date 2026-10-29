import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const systemChrome=process.platform==='win32'&&existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe');
const production=process.env.ARVEN_TEST_PRODUCTION==='true';
const baseURL=production?'http://127.0.0.1:3001':'http://127.0.0.1:5173';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:45000,
  globalSetup:'./tests/browser-setup.ts',
  use:{baseURL,viewport:{width:1440,height:1000},headless:true,channel:systemChrome?'chrome':undefined,trace:'retain-on-failure',screenshot:'only-on-failure',reducedMotion:'reduce'},
  webServer:{command:production?(process.platform==='win32'?'npm.cmd start':'npm start'):(process.platform==='win32'?'npm.cmd run dev':'npm run dev'),url:baseURL,reuseExistingServer:false,timeout:60000,env:{DATABASE_URL:'file:./browser.db',OPENROUTER_API_KEY:'',OPENAI_API_KEY:'',ENABLE_LIVE_SMS:'false'}},
  reporter:[['list'],['html',{open:'never'}]],
});
