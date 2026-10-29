import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { config } from 'dotenv';
if(!existsSync('.env')) {writeFileSync('.env','DATABASE_URL="file:./dev.db"\nPORT=3001\nHOST=127.0.0.1\n');console.log('Created local .env with safe defaults.');}
config({quiet:true});
// Creating an empty file first avoids a Prisma 6 schema-engine issue on Windows.
const url=process.env.DATABASE_URL||'file:./dev.db';
if(url.startsWith('file:')) {const file=resolve('database',url.slice(5));if(!existsSync(file))new DatabaseSync(file).close();}
for(const args of [['generate'],['db','push']]) {
  const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status||1);
}
const {seedDemo}=await import('../database/seed');
const {db}=await import('../backend/db');
// Setup is safe to repeat: use the explicit Reset Demo action to overwrite data.
if(!await db.preference.findUnique({where:{key:'businessName'}})) {await seedDemo();console.log('Sample workspace created.');}
else console.log('Existing workspace preserved.');
await db.$disconnect();
