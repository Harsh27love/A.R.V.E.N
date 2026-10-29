import { templates, workflowSchema, type WorkflowInput } from '../../shared/schema';

export function parseIntent(prompt:string): { content:string; proposal:WorkflowInput|null } {
  const p=prompt.toLowerCase();
  const index=/follow.?up|haven.?t replied|not replied|no reply|no response|unanswered/.test(p)?0
    :/appointment|no.show/.test(p)?1:/lead/.test(p)?2:/order|delivery|shipment/.test(p)?4
    :/summary|summaries|digest/.test(p)?5:/enquir|inquir|route/.test(p)?6:/schedule|every day|daily|tomorrow|message at/.test(p)?3:-1;
  if(index===-1) return {content:'I can help with customer follow-ups, appointment reminders, lead alerts, scheduled messages, order updates, daily summaries, and enquiry routing. What should trigger the automation, and should I use email, SMS, WhatsApp, or an internal notification?',proposal:null};
  const t=templates[index];
  const definition=structuredClone(t.definition);
  if(/whatsapp/.test(p)) definition.action.channel='whatsapp';
  else if(/\bsms\b|text message/.test(p)) definition.action.channel='sms';
  else if(/\bemail\b/.test(p)) definition.action.channel='email';
  const days=p.match(/(\d+|one|two|three|four|five|seven)\s+days?/);
  if(index===0&&days) definition.condition.value=String(({one:1,two:2,three:3,four:4,five:5,seven:7} as Record<string,number>)[days[1]]||Math.min(365,Math.max(1,Number(days[1]))));
  const every=p.match(/every\s+(\d+)\s+(minute|hour|day)/);
  if(every) {definition.trigger='schedule';definition.scheduleMinutes=Math.min(10080,Math.max(1,Number(every[1])*({minute:1,hour:60,day:1440}[every[2]]||1)));}
  const proposal=workflowSchema.parse({name:t.name,description:t.description,definition});
  return {content:`I’ve drafted “${t.name}”. ${index===0?`I’ll find customers who haven’t replied in ${definition.condition.value} days and prepare a friendly ${definition.action.channel} follow-up.`:`It will use ${definition.action.channel} and the ${definition.trigger.replace('_',' ')} trigger.`} Review the recipients, message, and timing below. Nothing runs until you approve.`,proposal};
}

export { proposeWithAI } from './openrouter';
