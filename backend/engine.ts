import { db, readExecution } from './db';
import { definitionSchema, type Definition, type EventKind, type LogEntry } from '../shared/schema';
import { seedDemo } from '../database/seed';

class Engine {
  private chain:Promise<unknown>=Promise.resolve();
  private timer:ReturnType<typeof setInterval>|undefined;
  exclusive<T>(fn:()=>Promise<T>):Promise<T> {
    const next=this.chain.then(fn,fn);this.chain=next.catch(()=>{});return next;
  }
  async start() {
    await db.execution.updateMany({where:{status:'running'},data:{status:'queued'}});
    this.timer=setInterval(()=>{this.exclusive(()=>this.tick()).catch(error=>console.error('Local scheduler:',error instanceof Error?error.message:'Unexpected error'));},1000);
    this.timer.unref();
  }
  stop(){if(this.timer) clearInterval(this.timer);}
  async run(workflowId:string,source='manual',simulateError=false,eventContactId?:string) {
    return this.exclusive(async()=>{
      const w=await db.workflow.findUniqueOrThrow({where:{id:workflowId}});
      if(source!=='test'&&w.status!=='active') throw new Error('This workflow must be active before it can run.');
      const definition=definitionSchema.parse(JSON.parse(w.definition));
      if(eventContactId) {
        if(definition.contactIds.length&&!definition.contactIds.includes(eventContactId)) return null;
        definition.contactIds=[eventContactId];
      }
      const logs:LogEntry[]=[{time:new Date().toISOString(),level:'info',message:`${source==='test'?'Test':source==='event'?'Sample customer event':source==='schedule'?'Scheduled trigger':'Manual trigger'} received. All actions use the local demo provider.`}];
      const e=await db.execution.create({data:{workflowId,definition:JSON.stringify(definition),source,simulateError,logs:JSON.stringify(logs)}});
      await this.process(e.id);
      return readExecution(await db.execution.findUniqueOrThrow({where:{id:e.id},include:{workflow:{select:{name:true}}}}));
    });
  }
  async event(event:EventKind,contactId?:string,workflowId?:string) {
    const workflows=await db.workflow.findMany({where:{status:'active',...(workflowId?{id:workflowId}:{})}});
    const results=[];
    for(const w of workflows) {
      const d=definitionSchema.parse(JSON.parse(w.definition));
      if(d.trigger==='customer_event'&&d.event===event) {
        const result=await this.run(w.id,'event',false,contactId);if(result) results.push(result);
      }
    }
    return results;
  }
  async cancel(id:string) {
    return this.exclusive(async()=>{
      const e=await db.execution.findUniqueOrThrow({where:{id}});
      if(!['queued','waiting','running'].includes(e.status)) throw new Error('Only pending executions can be cancelled.');
      const logs:LogEntry[]=JSON.parse(e.logs);logs.push({time:new Date().toISOString(),level:'info',message:'Cancelled by the user before the action ran.'});
      return readExecution(await db.execution.update({where:{id},data:{status:'cancelled',finishedAt:new Date(),logs:JSON.stringify(logs),resumeAt:null}}));
    });
  }
  async retry(id:string) {
    return this.exclusive(async()=>{
      const e=await db.execution.findUniqueOrThrow({where:{id}});
      if(e.status!=='failed') throw new Error('Only failed executions can be retried.');
      if(e.retryCount>=3) throw new Error('Retry limit reached (3). Inspect and test the workflow again.');
      const logs:LogEntry[]=JSON.parse(e.logs);logs.push({time:new Date().toISOString(),level:'info',message:'User requested a retry. The simulated failure has been cleared.'});
      await db.execution.update({where:{id},data:{status:'queued',simulateError:false,error:null,retryCount:{increment:1},logs:JSON.stringify(logs)}});
      await this.process(id);return readExecution(await db.execution.findUniqueOrThrow({where:{id}}));
    });
  }
  async reset(){return this.exclusive(()=>seedDemo());}
  async tick() {
    const now=new Date();
    const scheduled=await db.workflow.findMany({where:{status:'active',nextRunAt:{lte:now}}});
    for(const w of scheduled) {
      const d=definitionSchema.parse(JSON.parse(w.definition));
      if(d.trigger!=='schedule') continue;
      await db.$transaction(async tx=>{
        await tx.execution.create({data:{workflowId:w.id,definition:w.definition,source:'schedule',logs:JSON.stringify([{time:now.toISOString(),level:'info',message:'Scheduled trigger received. Local simulation only.'}])}});
        await tx.workflow.update({where:{id:w.id},data:{nextRunAt:new Date(now.getTime()+d.scheduleMinutes*60000)}});
      });
    }
    const pending=await db.execution.findMany({where:{OR:[{status:'queued'},{status:'waiting',resumeAt:{lte:now}}]},take:50});
    for(const e of pending) await this.process(e.id);
    await db.message.updateMany({where:{status:'scheduled',scheduledAt:{lte:now}},data:{status:'demo'}});
    const reminders=await db.contact.findMany({where:{followUpAt:{lte:now}},take:50});
    for(const contact of reminders) await db.$transaction(async tx=>{
      await tx.message.create({data:{contactId:contact.id,channel:'notification',subject:`Follow-up reminder: ${contact.name}`,body:`It’s time to follow up with ${contact.name}${contact.company?' at '+contact.company:''}. ${contact.notes}`,status:'demo'}});
      await tx.contact.update({where:{id:contact.id},data:{followUpAt:null}});
    });
  }
  private async process(id:string) {
    const e=await db.execution.findUniqueOrThrow({where:{id}});
    if(!['queued','waiting'].includes(e.status)) return;
    const logs:LogEntry[]=JSON.parse(e.logs);
    const log=(message:string,level:LogEntry['level']='info')=>logs.push({time:new Date().toISOString(),level,message});
    try {
      const d:Definition=definitionSchema.parse(JSON.parse(e.definition));
      if(d.delaySeconds>0&&!e.resumeAt) {
        log(`Waiting ${d.delaySeconds} seconds. This delay is persisted and can be cancelled.`);
        await db.execution.update({where:{id},data:{status:'waiting',resumeAt:new Date(Date.now()+d.delaySeconds*1000),logs:JSON.stringify(logs)}});return;
      }
      await db.execution.update({where:{id},data:{status:'running'}});
      if(e.simulateError) throw new Error('Simulated provider failure for testing. No message was sent. Retry to recover.');
      const contacts=await db.contact.findMany({where:d.contactIds.length?{id:{in:d.contactIds}}:{},orderBy:{createdAt:'asc'},take:10});
      const eligible=contacts.filter(c=> d.condition.field==='any'||(d.condition.field==='no_reply'&&(Date.now()-c.lastReplyAt.getTime())>=Number(d.condition.value||3)*86400000)||(d.condition.field==='status'&&c.status===d.condition.value)||(d.condition.field==='tag'&&(JSON.parse(c.tags) as string[]).includes(d.condition.value)));
      log(`Condition checked: ${eligible.length} of ${contacts.length} contacts matched. Maximum 10 contacts per run.`);
      const summary=d.event==='daily'?`${await db.contact.count()} contacts, ${await db.workflow.count({where:{status:'active'}})} active workflows, ${await db.execution.count({where:{status:'success'}})} successful demo runs.`:'';
      const recipients=d.event==='daily'?[null]:eligible;
      await db.$transaction(async tx=>{
        for(const contact of recipients) {
          const existing=await tx.message.findFirst({where:{executionId:id,contactId:contact?.id||null}});
          if(existing) continue;
          const body=d.action.body.replaceAll('{{name}}',contact?.name||'team').replaceAll('{{company}}',contact?.company||'your business').replaceAll('{{summary}}',summary);
          await tx.message.create({data:{executionId:id,contactId:contact?.id,channel:d.action.channel,subject:d.action.subject,body,status:'demo'}});
          log(`${d.action.channel==='notification'?'Internal notification':'Demo '+d.action.channel} recorded${contact?' for '+contact.name:''}. Demo — Not Sent.`,'success');
        }
        log(recipients.length?'Execution completed. No external delivery was attempted.':'No contacts matched. No messages were created.','success');
        await tx.execution.update({where:{id},data:{status:recipients.length?'success':'skipped',finishedAt:new Date(),logs:JSON.stringify(logs)}});
      });
    } catch(error) {
      const message=error instanceof Error?error.message:'Execution failed.';log(message,'error');
      await db.execution.update({where:{id},data:{status:'failed',error:message,finishedAt:new Date(),logs:JSON.stringify(logs)}});
    }
  }
}
export const engine=new Engine();
