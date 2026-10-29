import type { Integration } from '../../shared/schema';
let verifiedSid='';
const configured=()=>Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM&&process.env.ENABLE_LIVE_SMS==='true');
const auth=()=>`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
export const smsConnected=()=>configured()&&verifiedSid===process.env.TWILIO_ACCOUNT_SID;
export function integrations():Integration[] {
  return [
    {id:'gmail',name:'Gmail',description:'Make every follow-up feel personal.',status:'not_connected',detail:'Live Gmail OAuth is planned. Use the local email simulator now.',demo:true},
    {id:'whatsapp',name:'WhatsApp Business',description:'Be where your customers already are.',status:'not_connected',detail:'Live WhatsApp Business authorization is planned. No Meta credentials are connected.',demo:true},
    {id:'twilio',name:'Twilio SMS',description:'Timely updates, straight to their phone.',status:smsConnected()?'connected':'not_connected',detail:smsConnected()?'Account verified. Each live SMS still requires individual approval.':configured()?'Server credentials configured. Verify the account to connect.':'Optional live adapter. Configure server-side Twilio variables, then verify. Demo SMS works now.',demo:true},
    {id:'calendar',name:'Google Calendar',description:'A little less admin. A lot more time.',status:'not_connected',detail:'Live Google Calendar OAuth is planned. Appointment events can be simulated locally.',demo:true},
    {id:'webhooks',name:'Webhooks',description:'Bring your own events into the flow.',status:'not_connected',detail:'Authenticated local sample-event API is working. A public webhook endpoint is not deployed.',demo:true},
  ];
}
export async function verifySMS() {
  if(!configured()) throw new Error('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM and ENABLE_LIVE_SMS=true on the server, then restart.');
  const sid=process.env.TWILIO_ACCOUNT_SID!;
  if(!/^AC[a-f0-9]{32}$/i.test(sid)) throw new Error('Invalid Twilio account SID.');
  const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,{headers:{Authorization:auth()},signal:AbortSignal.timeout(15000)});
  if(!res.ok) throw new Error('Twilio did not authorize this account. Check server credentials.');
  const account=await res.json() as {sid:string;status:string};
  if(account.sid!==sid||account.status!=='active') throw new Error('Twilio account is not active.');
  verifiedSid=sid;return {connected:true};
}
export async function sendSMS(to:string,body:string) {
  if(!smsConnected()) throw new Error('Twilio is not connected and verified.');
  if(!/^\+[1-9]\d{7,14}$/.test(to)) throw new Error('Contact phone must use international E.164 format.');
  const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${verifiedSid}/Messages.json`,{method:'POST',headers:{Authorization:auth(),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:to,From:process.env.TWILIO_FROM!,Body:body}),signal:AbortSignal.timeout(15000)});
  if(!res.ok) throw new Error('Twilio rejected the message. Delivery was not confirmed.');
  const message=await res.json() as {sid:string;status:string};
  if(!/^SM[a-f0-9]{32}$/i.test(message.sid)) throw new Error('Provider returned no valid message receipt.');
  return {providerId:message.sid,status:message.status==='delivered'?'delivered':'provider_accepted'};
}
export async function checkSMS(sid:string) {
  if(!smsConnected()||!/^SM[a-f0-9]{32}$/i.test(sid)) throw new Error('A verified SMS connection and valid receipt are required.');
  const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${verifiedSid}/Messages/${sid}.json`,{headers:{Authorization:auth()},signal:AbortSignal.timeout(15000)});
  if(!res.ok) throw new Error('Provider status could not be confirmed.');
  const message=await res.json() as {status:string};
  return {status:message.status==='delivered'?'delivered':['failed','undelivered','canceled'].includes(message.status)?'failed':'provider_accepted'};
}
