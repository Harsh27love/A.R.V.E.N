import { z } from 'zod';

export const channelSchema = z.enum(['email', 'sms', 'whatsapp', 'notification']);
export const eventSchema = z.enum(['no_reply', 'appointment', 'lead', 'scheduled', 'order', 'daily', 'enquiry']);
export const definitionSchema = z.object({
  trigger: z.enum(['manual', 'schedule', 'customer_event']),
  event: eventSchema,
  condition: z.object({ field: z.enum(['any', 'no_reply', 'status', 'tag']), value: z.string().max(80) }).refine(c=>c.field!=='no_reply'||(/^\d+$/.test(c.value)&&Number(c.value)>=1&&Number(c.value)<=365),{message:'Days without a reply must be between 1 and 365.'}),
  delaySeconds: z.number().int().min(0).max(300),
  scheduleMinutes: z.number().int().min(1).max(10080),
  contactIds: z.array(z.string().min(1).max(100)).max(10),
  action: z.object({ channel: channelSchema, subject: z.string().min(1).max(180), body: z.string().min(1).max(3000) }),
  positions: z.record(z.string(),z.object({ x: z.number().finite(), y: z.number().finite() })).optional(),
});
export const workflowSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500).default(''), definition: definitionSchema });
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(180).transform(v => v.toLowerCase()),
  phone: z.string().max(30).default(''), company: z.string().max(100).default(''),
  status: z.enum(['lead', 'customer', 'vip', 'inactive']).default('lead'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]), notes: z.string().max(3000).default(''),
  optedIn: z.boolean().default(false), followUpAt: z.string().datetime().nullable().optional(),
});
export const messageSchema = z.object({
  contactId: z.string().max(100).optional(), channel: channelSchema,
  subject: z.string().trim().min(1).max(180), body: z.string().trim().min(1).max(3000),
  scheduledAt: z.string().datetime().nullable().optional(),
});
export type Definition = z.infer<typeof definitionSchema>;
export type WorkflowInput = z.infer<typeof workflowSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type EventKind = z.infer<typeof eventSchema>;
export type Workflow = WorkflowInput & { id: string; status: string; nextRunAt: string | null; updatedAt: string; createdAt: string; _count?: {executions:number} };
export type Contact = ContactInput & { id: string; lastReplyAt: string; createdAt: string };
export type LogEntry = { time: string; level: 'info' | 'success' | 'error'; message: string };
export type Execution = { id: string; workflowId: string; workflow?: { name: string }; status: string; source: string; logs: LogEntry[]; retryCount: number; error: string | null; startedAt: string; finishedAt: string | null; resumeAt: string | null };
export type Message = { id: string; contactId: string | null; contact?: Contact | null; channel: Channel; subject: string; body: string; direction: string; status: string; createdAt: string; scheduledAt: string | null; providerId?: string | null };
export type Chat = { id: string; role: string; content: string; proposal?: WorkflowInput | null; createdAt: string };
export type Integration = { id: string; name: string; description: string; status: 'not_connected' | 'connected'; detail: string; demo: boolean };
export type Stats = { workflows: number; active: number; tasks: number; success: number; failed: number; cancelled: number; messages: number; contacts: number; estimatedMinutes: number; successRate: number; chart: { day: string; executions: number; messages: number }[]; channels: { name: string; value: number; fill: string }[] };

export const baseDefinition: Definition = {
  trigger: 'customer_event', event: 'no_reply', condition: { field: 'no_reply', value: '3' },
  delaySeconds: 0, scheduleMinutes: 1440, contactIds: [],
  action: { channel: 'email', subject: 'A little follow-up from our shop', body: 'Hi {{name}}, just checking in on your enquiry. Is there anything we can help you with? We would love to hear from you.' },
};
export const eventLabels: Record<EventKind,string> = { no_reply: 'No reply for 3 days', appointment: 'Upcoming appointment', lead: 'New lead received', scheduled: 'Scheduled message', order: 'Order status changed', daily: 'Daily business summary', enquiry: 'Customer enquiry' };
export const templates: (WorkflowInput & { icon: string; color: string; prompt: string })[] = [
  { name: 'Customer follow-up', description: 'A thoughtful nudge, right on time.', definition: baseDefinition, icon: 'mail', color: 'mint', prompt: "Remind customers who haven't replied in three days." },
  { name: 'Appointment reminder', description: 'Fewer no-shows. Happier customers.', definition: {...baseDefinition, event:'appointment', condition:{field:'any',value:''}, action:{channel:'sms', subject:'Your appointment reminder', body:'Hi {{name}}, a friendly reminder about your upcoming appointment. Reply to confirm.'}}, icon:'calendar',color:'violet',prompt:'Send appointment reminders by SMS.' },
  { name:'New lead alert',description:'Be the first to say hello.',definition:{...baseDefinition,event:'lead',condition:{field:'status',value:'lead'},action:{channel:'notification',subject:'A new lead needs you',body:'New lead: {{name}} at {{company}}. Open Contacts to follow up.'}},icon:'zap',color:'amber',prompt:'Notify me when a new lead arrives.' },
  { name:'Scheduled check-in',description:'The right message at the right moment.',definition:{...baseDefinition,trigger:'schedule',event:'scheduled',condition:{field:'any',value:''},action:{channel:'whatsapp',subject:'A quick check-in',body:'Hi {{name}}, how can we help you today?'}},icon:'clock',color:'blue',prompt:'Schedule a WhatsApp message every day.' },
  { name:'Order update',description:'Keep customers in the loop.',definition:{...baseDefinition,event:'order',condition:{field:'any',value:''},action:{channel:'whatsapp',subject:'Your order update',body:'Hi {{name}}, your order status has changed. Contact our team for the latest details.'}},icon:'package',color:'mint',prompt:'Send WhatsApp notifications when order status changes.' },
  { name:'Daily business digest',description:'Your day, beautifully summarized.',definition:{...baseDefinition,trigger:'schedule',event:'daily',condition:{field:'any',value:''},action:{channel:'notification',subject:'Your daily business summary',body:'Your local business activity: {{summary}}'}},icon:'chart',color:'violet',prompt:'Give me a daily business summary.' },
  { name:'Enquiry routing',description:'Every question finds its person.',definition:{...baseDefinition,event:'enquiry',condition:{field:'any',value:''},action:{channel:'notification',subject:'Customer enquiry to review',body:'New enquiry from {{name}} at {{company}}. Please review their conversation in the Communication Hub.'}},icon:'route',color:'blue',prompt:'Route customer enquiries to my team.' },
];
