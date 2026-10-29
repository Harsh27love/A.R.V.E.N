import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
export default function setup(){
  new DatabaseSync('database/browser.db').close();
  for(const [entry,...args] of [['node_modules/prisma/build/index.js','db','push','--skip-generate'],['node_modules/tsx/dist/cli.mjs','database/seed.ts']]) {
    const result=spawnSync(process.execPath,[entry,...args],{env:{...process.env,DATABASE_URL:'file:./browser.db'},encoding:'utf8'});
    if(result.status!==0)throw new Error(`Browser database setup failed: ${result.stderr}`);
  }
}
