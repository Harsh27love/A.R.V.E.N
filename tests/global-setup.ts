import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
export default function setup(){
  new DatabaseSync('database/test.db').close();
  const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:'file:./test.db'},encoding:'utf8'});
  if(result.status!==0)throw new Error(`Test database setup failed: ${result.stderr}`);
}
