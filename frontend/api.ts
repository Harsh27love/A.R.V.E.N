import type { Chat, Contact, Execution, Integration, Message, Stats, Workflow } from '../shared/schema';
export type Workspace = { workflows:Workflow[]; contacts:Contact[]; executions:Execution[]; messages:Message[]; chat:Chat[]; preferences:Record<string,string>; integrations:Integration[]; aiConfigured:boolean; aiProvider:string; aiModel:string };
let session:Promise<string>|null=null;
async function getToken() {return session||=(fetch('/api/session').then(async r=>{if(!r.ok)throw new Error('Cannot reach the local backend.');return (await r.json()).token as string;}).catch(e=>{session=null;throw e;}));}
export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T> {
  const token=await getToken();
  const response=await fetch(`/api${path}`,{method,headers:{'Content-Type':'application/json','x-arven-session':token},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===401)session=null;
  const data=await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
  if(!response.ok) throw new Error(data.error||'The request could not be completed.');
  return data as T;
}
export const loadWorkspace=()=>Promise.all([api<Workspace>('/state'),api<Stats>('/stats')]);
