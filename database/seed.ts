import { db } from '../backend/db';
import { templates } from '../shared/schema';
import { pathToFileURL } from 'node:url';

export async function seedDemo() {
  const now=Date.now();
  await db.$transaction(async tx => {
    await tx.message.deleteMany(); await tx.execution.deleteMany(); await tx.workflow.deleteMany();
    await tx.contact.deleteMany(); await tx.chatMessage.deleteMany(); await tx.preference.deleteMany();
    const customers = [
      ['contact-aarav','Aarav Sharma','aarav@example.com','+919876500101','Sharma Electronics','lead',['Follow-up','Retail'],4,'Interested in the smart inventory package. Waiting on a quote.'],
      ['contact-priya','Priya Patel','priya@example.com','+919876500102','Bloom Studio','vip',['Design','Priority'],1,'Regular customer. Prefers a friendly, personal message.'],
      ['contact-rohan','Rohan Mehta','rohan@example.com','+919876500103','Mehta General Store','customer',['Retail'],5,'Asked about delivery timelines for a repeat order.'],
      ['contact-ananya','Ananya Iyer','ananya@example.com','+919876500104','The Good Bean','lead',['Hospitality','New lead'],0,'New enquiry about automating café orders.'],
      ['contact-vikram','Vikram Singh','vikram@example.com','+919876500105','Singh & Sons','customer',['Wholesale'],2,'Appointment scheduled to discuss the business package.'],
      ['contact-zoya','Zoya Khan','zoya@example.com','+919876500106','Zoya Collective','vip',['Fashion','Priority'],6,'Would like an update on the latest collection.'],
    ] as const;
    for (const [id,name,email,phone,company,status,tags,days,notes] of customers) {
      await tx.contact.create({data:{id,name,email,phone,company,status,tags:JSON.stringify(tags),notes,optedIn:true,lastReplyAt:new Date(now-days*86400000),followUpAt:days>=3?new Date(now+86400000):null}});
    }
    for (const [index,t] of templates.slice(0,6).entries()) {
      const definition={...t.definition,contactIds:index===0?['contact-aarav']:index===1?['contact-vikram']:index===2?['contact-ananya']:index===4?['contact-rohan']:[]};
      const w=await tx.workflow.create({data:{id:`workflow-${index+1}`,name:t.name,description:t.description,definition:JSON.stringify(definition),status:index<3?'active':index===3?'paused':'draft'}});
      if (index < 3) {
        for (let day=6;day>=0;day--) {
          if (![[6,4,3,1,0],[5,3,2,1,0],[3,2,1,0]][index].includes(day)) continue;
          const time=new Date(now-day*86400000-(index+1)*3600000);
          const logs=[{time:time.toISOString(),level:'info',message:'Seeded sample execution for the showcase.'},{time:time.toISOString(),level:'success',message:'Demo action recorded locally. No external message was sent.'}];
          const e=await tx.execution.create({data:{workflowId:w.id,definition:w.definition,status:'success',source:'seed',logs:JSON.stringify(logs),startedAt:time,finishedAt:time}});
          await tx.message.create({data:{contactId:definition.contactIds[0],executionId:e.id,channel:definition.action.channel,subject:definition.action.subject,body:definition.action.body.replace('{{name}}',customers[index][1]).replace('{{company}}',customers[index][4]),status:'demo',createdAt:time}});
        }
      }
    }
    const incoming=[['contact-aarav','email','Could you share a quote?','Hi! I’m interested in your business automation package. Could you send me a little more detail?'],['contact-priya','whatsapp','Thanks for the update','That sounds perfect. Let’s go ahead with the next steps!'],['contact-rohan','email','Checking on my order','Hello, any update on when my order will be ready?'],['contact-vikram','sms','Appointment confirmation','See you tomorrow. Thank you for arranging this.']];
    for(const [contactId,channel,subject,body] of incoming) await tx.message.create({data:{contactId,channel,subject,body,direction:'incoming',status:'received',createdAt:new Date(now-3600000)}});
    await tx.preference.createMany({data:[{key:'businessName',value:'My workspace'},{key:'ownerName',value:'Alex'},{key:'reducedMotion',value:'false'},{key:'demoMode',value:'true'},{key:'notifications',value:'true'}]});
    await tx.chatMessage.create({data:{role:'assistant',content:'Hey, I’m SYNO. Tell me what’s taking up your time, and let’s put it on autopilot. I’ll draft a workflow for you to review before anything runs. This is Demo Mode — every message stays safely inside this app.'}});
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  seedDemo().then(()=>console.log('Demo workspace ready: 6 contacts, 6 workflows, sample local history.')).finally(()=>db.$disconnect());
}
