import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { db, readChat, readContact, readExecution, readWorkflow } from './db';
import { contactSchema, eventSchema, messageSchema, workflowSchema } from '../shared/schema';
import { parseIntent, proposeWithAI } from './integrations/ai';
import { getAIModel, AI_PROVIDER, AIProviderError, isAIConfigured, testAIConnection } from './integrations/openrouter';
import { checkSMS, integrations, sendSMS, verifySMS } from './integrations/providers';
import { engine } from './engine';

const idSchema=z.string().min(1).max(100);
function id(req:Request){return idSchema.parse(req.params.id);}
async function assertContacts(ids:string[]) {
  if(ids.length&&await db.contact.count({where:{id:{in:ids}}})!==new Set(ids).size) throw new Error('One or more selected contacts no longer exist.');
}
export function createApp() {
  const app=express();const token=randomBytes(32).toString('hex');app.locals.token=token;
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],fontSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false}));
  app.use(express.json({limit:'150kb'}));
  app.use('/api',(req,res,next)=>{
    const host=(req.hostname||'').toLowerCase();
    if(!['localhost','127.0.0.1','::1','[::1]'].includes(host)) {res.status(403).json({error:'This MVP accepts local requests only.'});return;}
    const origin=req.get('origin');
    if(origin&&!['http://127.0.0.1:5173','http://localhost:5173',`http://127.0.0.1:${process.env.PORT||3001}`,`http://localhost:${process.env.PORT||3001}`].includes(origin)) {res.status(403).json({error:'Origin not allowed.'});return;}
    next();
  });
  app.get('/api/health',(_req,res)=>res.json({status:'ok',mode:'local-prototype'}));
  app.get('/api/session',(_req,res)=>{res.set('Cache-Control','no-store');res.json({token});});
  app.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const supplied=req.get('x-arven-session')||'';
    if(supplied.length!==token.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))) {res.status(401).json({error:'Local session expired. Reload the app.'});return;}
    next();
  });
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Please wait a moment.'}}));

  app.get('/api/state',async(_req,res)=>{
    const [workflows,contacts,messages,executions,preferences,chat]=await Promise.all([
      db.workflow.findMany({orderBy:{updatedAt:'desc'},include:{_count:{select:{executions:true}}}}),
      db.contact.findMany({orderBy:{name:'asc'}}),
      db.message.findMany({orderBy:{createdAt:'desc'},take:200,include:{contact:true}}),
      db.execution.findMany({orderBy:{startedAt:'desc'},take:100,include:{workflow:{select:{name:true}}}}),
      db.preference.findMany(),db.chatMessage.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],take:100}),
    ]);
    res.json({workflows:workflows.map(readWorkflow),contacts:contacts.map(readContact),messages:messages.map(m=>({...m,contact:m.contact?readContact(m.contact):null})),executions:executions.map(readExecution),preferences:Object.fromEntries(preferences.map(p=>[p.key,p.value])),chat:chat.reverse().map(readChat),integrations:integrations(),aiConfigured:isAIConfigured(),aiProvider:AI_PROVIDER,aiModel:getAIModel()});
  });
  app.get('/api/stats',async(_req,res)=>{
    const [workflows,active,success,failed,cancelled,messages,contacts,history,communication,channels]=await Promise.all([
      db.workflow.count(),db.workflow.count({where:{status:'active'}}),db.execution.count({where:{status:'success'}}),db.execution.count({where:{status:'failed'}}),db.execution.count({where:{status:'cancelled'}}),db.message.count({where:{direction:'outgoing'}}),db.contact.count(),
      db.execution.findMany({where:{startedAt:{gte:new Date(Date.now()-7*86400000)}},select:{startedAt:true,status:true}}),
      db.message.findMany({where:{direction:'outgoing',createdAt:{gte:new Date(Date.now()-7*86400000)}},select:{createdAt:true}}),
      db.message.groupBy({by:['channel'],where:{direction:'outgoing'},_count:true}),
    ]);
    const colors:Record<string,string>={email:'#7ce7c6',sms:'#a79af7',whatsapp:'#65aafa',notification:'#e8bb78'};
    const chart=Array.from({length:7},(_,i)=>{const date=new Date(Date.now()-(6-i)*86400000);const iso=date.toISOString().slice(0,10);return {day:date.toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}),executions:history.filter(e=>e.startedAt.toISOString().startsWith(iso)).length,messages:communication.filter(m=>m.createdAt.toISOString().startsWith(iso)).length};});
    res.json({workflows,active,tasks:success,success,failed,cancelled,messages,contacts,estimatedMinutes:success*5,successRate:success+failed?Math.round(success/(success+failed)*100):0,chart,channels:channels.map(c=>({name:c.channel,value:c._count,fill:colors[c.channel]}))});
  });
  app.post('/api/workflows',async(req,res)=>{
    const input=workflowSchema.parse(req.body);await assertContacts(input.definition.contactIds);
    const w=await db.workflow.create({data:{...input,definition:JSON.stringify(input.definition)}});res.status(201).json(readWorkflow(w));
  });
  app.put('/api/workflows/:id',async(req,res)=>{
    const input=workflowSchema.parse(req.body);await assertContacts(input.definition.contactIds);
    const w=await db.workflow.update({where:{id:id(req)},data:{...input,definition:JSON.stringify(input.definition),status:'draft',nextRunAt:null}});res.json(readWorkflow(w));
  });
  app.post('/api/workflows/:id/status',async(req,res)=>{
    const {status,approved}=z.object({status:z.enum(['active','paused']),approved:z.boolean().optional()}).parse(req.body);
    if(status==='active'&&!approved) {res.status(400).json({error:'Review and explicitly approve the workflow before activation.'});return;}
    const w=await db.workflow.findUniqueOrThrow({where:{id:id(req)}});
    const d=workflowSchema.shape.definition.parse(JSON.parse(w.definition));
    res.json(readWorkflow(await db.workflow.update({where:{id:w.id},data:{status,nextRunAt:status==='active'&&d.trigger==='schedule'?new Date(Date.now()+d.scheduleMinutes*60000):null}})));
  });
  app.post('/api/workflows/:id/duplicate',async(req,res)=>{
    const w=await db.workflow.findUniqueOrThrow({where:{id:id(req)}});
    res.status(201).json(readWorkflow(await db.workflow.create({data:{name:`${w.name.slice(0,90)} (copy)`,description:w.description,definition:w.definition}})));
  });
  app.delete('/api/workflows/:id',async(req,res)=>{
    await engine.exclusive(async()=>{await db.workflow.delete({where:{id:id(req)}});});res.json({ok:true});
  });
  app.post('/api/workflows/:id/run',async(req,res)=>{
    const {test,simulateError}=z.object({test:z.boolean().default(false),simulateError:z.boolean().default(false)}).parse(req.body);
    const w=await db.workflow.findUniqueOrThrow({where:{id:id(req)}});
    if(!test&&w.status!=='active') {res.status(400).json({error:'Activate and approve this workflow first, or use Test.'});return;}
    res.json(await engine.run(w.id,test?'test':'manual',simulateError));
  });
  app.post('/api/executions/:id/retry',async(req,res)=>res.json(await engine.retry(id(req))));
  app.post('/api/executions/:id/cancel',async(req,res)=>res.json(await engine.cancel(id(req))));
  app.post('/api/events',async(req,res)=>{
    const {event,contactId,workflowId}=z.object({event:eventSchema,contactId:z.string().max(100).optional(),workflowId:z.string().max(100).optional()}).parse(req.body);
    if(contactId) await db.contact.findUniqueOrThrow({where:{id:contactId}});
    const results=await engine.event(event,contactId,workflowId);res.json({executions:results,count:results.length});
  });
  app.post('/api/contacts',async(req,res)=>{
    const input=contactSchema.parse(req.body);res.status(201).json(readContact(await db.contact.create({data:{...input,tags:JSON.stringify(input.tags)}})));
  });
  app.put('/api/contacts/:id',async(req,res)=>{
    const input=contactSchema.parse(req.body);res.json(readContact(await db.contact.update({where:{id:id(req)},data:{...input,tags:JSON.stringify(input.tags)}})));
  });
  app.post('/api/contacts/import',async(req,res)=>{
    const inputs=z.array(contactSchema).min(1).max(100).parse(req.body.contacts);
    const result=await db.$transaction(inputs.map(input=>db.contact.upsert({where:{email:input.email},create:{...input,tags:JSON.stringify(input.tags)},update:{...input,tags:JSON.stringify(input.tags)}})));
    res.json({count:result.length});
  });
  app.delete('/api/contacts/:id',async(req,res)=>{await db.contact.delete({where:{id:id(req)}});res.json({ok:true});});
  app.post('/api/messages',async(req,res)=>{
    const input=messageSchema.parse(req.body);
    if(input.channel!=='notification'&&!input.contactId) throw new Error('Choose a recipient.');
    if(input.contactId) await db.contact.findUniqueOrThrow({where:{id:input.contactId}});
    if(input.scheduledAt&&new Date(input.scheduledAt).getTime()<=Date.now()) throw new Error('Choose a future schedule time.');
    const m=await db.message.create({data:{...input,status:input.scheduledAt?'scheduled':'demo'}});res.status(201).json(m);
  });
  app.post('/api/messages/:id/cancel',async(req,res)=>{
    const m=await db.message.findUniqueOrThrow({where:{id:id(req)}});
    if(m.status!=='scheduled') throw new Error('Only scheduled messages can be cancelled.');
    res.json(await db.message.update({where:{id:m.id},data:{status:'cancelled'}}));
  });
  const liveRate=rateLimit({windowMs:3600000,limit:5,message:{error:'Live SMS limit: five individual messages per hour.'}});
  app.post('/api/messages/:id/send-live',liveRate,async(req,res)=>{
    const input=z.object({approved:z.literal(true),phoneConfirmation:z.string().min(4).max(4)}).parse(req.body);
    await engine.exclusive(async()=>{
      const m=await db.message.findUniqueOrThrow({where:{id:id(req)},include:{contact:true}});
      if(m.contact?.id.startsWith('contact-')) throw new Error('Sample contacts cannot receive live messages. Create a contact with real details and recorded consent.');
      if(m.channel!=='sms'||m.status!=='demo'||!m.contact?.optedIn) throw new Error('Only an unsent demo SMS to a contact with recorded consent can be sent.');
      if(!m.contact.phone.endsWith(input.phoneConfirmation)) throw new Error('Phone confirmation does not match.');
      await db.message.update({where:{id:m.id},data:{status:'sending'}});
      try {const receipt=await sendSMS(m.contact.phone,m.body);res.json(await db.message.update({where:{id:m.id},data:receipt}));}
      catch(error) {await db.message.update({where:{id:m.id},data:{status:'delivery_unknown'}});throw error;}
    });
  });
  app.post('/api/messages/:id/check-delivery',async(req,res)=>{
    const m=await db.message.findUniqueOrThrow({where:{id:id(req)}});if(!m.providerId) throw new Error('This message has no provider receipt.');
    const receipt=await checkSMS(m.providerId);res.json(await db.message.update({where:{id:m.id},data:receipt}));
  });
  app.post('/api/integrations/twilio/verify',async(_req,res)=>res.json(await verifySMS()));
  app.post('/api/ai/test',rateLimit({windowMs:60000,limit:3,message:{error:'Limit: three AI connection checks per minute.',code:'AI_TEST_RATE_LIMITED'}}),async(_req,res)=>res.json(await testAIConnection()));
  app.post('/api/chat',async(req,res)=>{
    const {prompt,mode}=z.object({prompt:z.string().trim().min(3).max(2000),mode:z.enum(['demo','ai']).default('demo')}).parse(req.body);
    const result=mode==='ai'?await proposeWithAI(prompt):parseIntent(prompt);
    const messages=await db.$transaction(async tx=>{
      const user=await tx.chatMessage.create({data:{role:'user',content:prompt}});
      const assistant=await tx.chatMessage.create({data:{role:'assistant',content:result.content,proposal:result.proposal?JSON.stringify(result.proposal):null}});
      return [user,assistant].map(readChat);
    });res.json({messages,mode});
  });
  app.delete('/api/chat',async(_req,res)=>{await db.chatMessage.deleteMany();res.json({ok:true});});
  app.put('/api/preferences',async(req,res)=>{
    const p=z.object({businessName:z.string().trim().min(1).max(80).optional(),ownerName:z.string().trim().min(1).max(60).optional(),reducedMotion:z.enum(['true','false']).optional(),demoMode:z.enum(['true','false']).optional(),notifications:z.enum(['true','false']).optional()}).strict().parse(req.body);
    await db.$transaction(Object.entries(p).map(([key,value])=>db.preference.upsert({where:{key},create:{key,value},update:{value}})));res.json({ok:true});
  });
  app.post('/api/reset',async(req,res)=>{z.object({confirmed:z.literal(true)}).parse(req.body);await engine.reset();res.json({ok:true});});
  app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
  app.use(express.static(resolve('dist')));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof AIProviderError) {res.status(error.status).json({error:error.message,code:error.code,provider:AI_PROVIDER,model:getAIModel()});return;}
    if(error instanceof ZodError) {res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
    if(error instanceof Prisma.PrismaClientKnownRequestError) {res.status(error.code==='P2025'?404:409).json({error:error.code==='P2002'?'A contact with this email already exists.':error.code==='P2025'?'That record no longer exists.':'The database could not apply this change.'});return;}
    if(error instanceof SyntaxError) {res.status(400).json({error:'Invalid request data.'});return;}
    res.status(400).json({error:error instanceof Error?error.message:'Something went wrong. Please try again.'});
  });
  return app;
}
