import 'dotenv/config';
import { createApp } from './app';
import { db } from './db';
import { engine } from './engine';
import { seedDemo } from '../database/seed';

const port=Number(process.env.PORT||3001);
if(!['127.0.0.1','localhost','::1'].includes(process.env.HOST||'127.0.0.1')) throw new Error('This single-user MVP must bind to a loopback address.');
async function main() {
  await db.$connect();
  if(!await db.preference.findUnique({where:{key:'businessName'}})) await seedDemo();
  await engine.start();
  const server=createApp().listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`A.R.V.E.N. API + production app: http://127.0.0.1:${port}`));
  const stop=()=>{engine.stop();server.close(()=>{db.$disconnect().finally(()=>process.exit(0));});};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(error=>{console.error(error);process.exit(1);});
