import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { Activity, ArrowRight, AudioLines, Bell, BookOpen, Boxes, ChevronDown, ChevronRight, CircleHelp, Command, FlaskConical, GitBranch, LayoutDashboard, Menu, MessageSquare, Network, Play, Plus, Search, Settings2, ShoppingBag, Sparkles, Users, X, Zap } from 'lucide-react';
import { api, loadWorkspace, type Workspace } from './api';
import { AppContext, pages, type Editable, type Page } from './context';
import { Avatar, Badge, Brand, Button, Confirmation, IconButton, Modal, SynoMark, Toasts } from './components';
import type { Execution, Stats } from '../shared/schema';
const Overview=lazy(()=>import('./pages/Dashboard').then(m=>({default:m.Overview})));
const Analytics=lazy(()=>import('./pages/Dashboard').then(m=>({default:m.Analytics})));
const Syno=lazy(()=>import('./pages/Syno').then(m=>({default:m.Syno})));
const Studio=lazy(()=>import('./pages/Workflows').then(m=>({default:m.Studio})));
const Workflows=lazy(()=>import('./pages/Workflows').then(m=>({default:m.Workflows})));
const ExecutionLog=lazy(()=>import('./pages/Workflows').then(m=>({default:m.ExecutionLog})));
const Contacts=lazy(()=>import('./pages/Contacts').then(m=>({default:m.Contacts})));
const Communication=lazy(()=>import('./pages/Communication').then(m=>({default:m.Communication})));
const Hardware=lazy(()=>import('./pages/Hardware').then(m=>({default:m.Hardware})));
const Integrations=lazy(()=>import('./pages/Settings').then(m=>({default:m.Integrations})));
const Settings=lazy(()=>import('./pages/Settings').then(m=>({default:m.Settings})));

const navigation=[
  {id:'overview',label:'Overview',icon:LayoutDashboard}, {id:'syno',label:'SYNO Assistant',icon:Sparkles},
  {id:'studio',label:'Automation Studio',icon:Network}, {id:'workflows',label:'My Workflows',icon:GitBranch},
  {id:'communication',label:'Communication Hub',icon:MessageSquare}, {id:'contacts',label:'Customers & Contacts',icon:Users},
  {id:'analytics',label:'Analytics',icon:Activity}, {id:'hardware',label:'Hardware Store',icon:ShoppingBag},
  {id:'integrations',label:'Integrations',icon:Boxes}, {id:'settings',label:'Settings',icon:Settings2},
] as const;
const initialPage=()=>pages.includes(window.location.hash.slice(1).split('?')[0] as Page)?window.location.hash.slice(1).split('?')[0] as Page:'overview';

export function App() {
  const [data,setData]=useState<Workspace|null>(null),[stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
  const [page,setPage]=useState<Page>(initialPage),[search,setSearch]=useState(''),[sideOpen,setSideOpen]=useState(false);
  const [modal,setModal]=useState<ReactNode>(null),[toasts,setToasts]=useState<{id:number;message:string;error:boolean}[]>([]);
  const [editing,setEditing]=useState<Editable|null>(null),[prompt,setPrompt]=useState(''),[tour,setTour]=useState(0),[demoWorkflow,setDemoWorkflow]=useState('');
  const [searchOpen,setSearchOpen]=useState(false),[notifications,setNotifications]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);const toastCounter=useRef(0);const refreshing=useRef<Promise<void>|null>(null);
  const toast=useCallback((message:string,error=false)=>{const id=++toastCounter.current;setToasts(t=>[...t.slice(-3),{id,message,error}]);window.setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),6000);},[]);
  const refresh=useCallback(async()=>{
    if(refreshing.current) return refreshing.current;
    const pending=loadWorkspace().then(([d,s])=>{setData(d);setStats(s);setError('');}).finally(()=>{refreshing.current=null;});refreshing.current=pending;return pending;
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(e.message));const interval=window.setInterval(()=>{void refresh().catch(()=>{});},5000);return()=>window.clearInterval(interval);},[refresh]);
  const nav=useCallback((p:Page)=>{setPage(p);window.location.hash=p;setSideOpen(false);setSearch('');setSearchOpen(false);setNotifications(false);window.scrollTo(0,0);},[]);
  useEffect(()=>{const hash=()=>setPage(initialPage());const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();searchRef.current?.focus();setSearchOpen(true);}if(e.key==='Escape'){setSearchOpen(false);setSideOpen(false);setNotifications(false);}};window.addEventListener('hashchange',hash);window.addEventListener('keydown',key);return()=>{window.removeEventListener('hashchange',hash);window.removeEventListener('keydown',key);};},[]);
  const closeModal=useCallback(()=>setModal(null),[]);
  const act=useCallback(async<T,>(fn:()=>Promise<T>,success?:string):Promise<T|undefined>=>{try {const result=await fn();await refresh();if(success)toast(success);return result;}catch(e){toast(e instanceof Error?e.message:'Something went wrong.',true);return undefined;}},[refresh,toast]);
  const confirm=useCallback((title:string,description:string,fn:()=>Promise<unknown>,label='Confirm',danger=false)=>{setModal(<Confirmation title={title} description={description} label={label} danger={danger} onClose={closeModal} confirm={()=>{closeModal();void act(fn);}}/>);},[act,closeModal]);
  const edit=useCallback((w?:Editable)=>{setEditing(w?structuredClone(w):null);nav('studio');},[nav]);
  const logs=useCallback((e:Execution)=>setModal(<ExecutionLog executionId={e.id} onClose={closeModal}/>),[closeModal]);
  const startTour=()=>setModal(<Modal title="A little shop. A big possibility." onClose={closeModal}><div className="tour-intro"><div className="tour-intro-icon"><Sparkles size={30}/></div><Badge tone="mint">THE FOUNDER’S SHOWCASE</Badge><h2>From “I’ll do it later”<br/>to already taken care of.</h2><p>Aarav asked your shop for a quote four days ago. You’ve been busy. Let SYNO help you follow up.</p><div className="tour-preview-steps">{['Tell SYNO','Review & approve','Trigger a sample event','See the result'].map((s,i)=><span key={s}><b>{i+1}</b>{s}</span>)}</div><div className="inline-notice"><FlaskConical size={16}/> Local simulation. No credentials or external messages.</div><Button variant="primary" onClick={()=>{setTour(1);setDemoWorkflow('');setPrompt("Remind customers who haven't replied in three days.");nav('syno');closeModal();}}>Start the showcase <ArrowRight size={16}/></Button></div></Modal>);

  if(!data||!stats) return <main className="boot"><Brand/>{error?<><h1>Let’s connect your workspace.</h1><p>{error}</p><p>Start the backend with <code>npm run dev</code> after <code>npm run setup</code>.</p><Button variant="primary" onClick={()=>void refresh().catch(e=>setError(e.message))}>Try again</Button></>:<><div className="boot-orbit"/><p>Bringing your workspace into flow…</p></>}</main>;
  const current=navigation.find(n=>n.id===page)!;
  const name=data.preferences.ownerName||'Alex';
  const results=search.trim()?[
    ...navigation.filter(n=>n.label.toLowerCase().includes(search.toLowerCase())).map(n=>({key:n.id,label:n.label,kind:'Page',action:()=>nav(n.id)})),
    ...data.workflows.filter(w=>w.name.toLowerCase().includes(search.toLowerCase())).map(w=>({key:w.id,label:w.name,kind:'Workflow',action:()=>edit(w)})),
    ...data.contacts.filter(c=>`${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase())).map(c=>({key:c.id,label:c.name,kind:'Contact',action:()=>{nav('contacts');setSearch(c.name);}})),
  ].slice(0,8):[];
  return <MotionConfig reducedMotion={data.preferences.reducedMotion==='true'?'always':'user'}><AppContext.Provider value={{data,stats,page,search,setSearch,nav,refresh,toast,act,modal:setModal,closeModal,confirm,edit,editing,setEditing,logs,prompt,setPrompt,tour,setTour,demoWorkflow,setDemoWorkflow}}><div className={`app ${data.preferences.reducedMotion==='true'?'reduce-motion':''}`}>
    <a href="#main-content" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Skip to content</a>
    {sideOpen&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setSideOpen(false)}/>}
    <aside className={`sidebar ${sideOpen?'sidebar-open':''}`} aria-label="Main navigation">
      <div className="sidebar-brand"><Brand/><Badge>OS 0.1</Badge></div>
      <button className="workspace-switch" onClick={()=>nav('settings')}><span className="workspace-avatar"><Boxes size={17}/></span><span><b>{data.preferences.businessName}</b><small>Personal workspace</small></span><ChevronDown size={14}/></button>
      <div className="nav-caption">WORKSPACE</div><nav>{navigation.slice(0,7).map(n=><button key={n.id} onClick={()=>nav(n.id)} className={`nav-item ${page===n.id?'active':''}`} aria-current={page===n.id?'page':undefined}><n.icon size={18}/><span>{n.label}</span>{n.id==='syno'?<span className="nav-ai">AI</span>:n.id==='workflows'?<span className="nav-count">{data.workflows.length}</span>:null}</button>)}</nav>
      <div className="nav-caption nav-caption-second">ECOSYSTEM</div><nav>{navigation.slice(7).map(n=><button key={n.id} onClick={()=>nav(n.id)} className={`nav-item ${page===n.id?'active':''}`} aria-current={page===n.id?'page':undefined}><n.icon size={18}/><span>{n.label}</span>{n.id==='hardware'&&<span className="nav-new">CONCEPT</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-syno"><div className="sidebar-syno-head"><SynoMark/><span>A little less busy.<br/><b>A lot more possible.</b></span></div><p>Your next great workflow starts with a conversation.</p><button onClick={()=>nav('syno')}>Let’s build with SYNO <ArrowRight size={14}/></button></div><button className="help-link" onClick={()=>setModal(<Modal title="Your workspace, explained" onClose={closeModal}><div className="help-content"><BookOpen size={25}/><p>A.R.V.E.N. is a working local prototype. Ask SYNO to draft an automation, review it in the Studio, then approve and run it.</p><p>Messages labeled “Demo — Not Sent” stay in this app. Scheduled jobs run while the local backend is open. Hardware is conceptual.</p><Button variant="primary" onClick={startTour}>Open guided showcase <Play size={14}/></Button></div></Modal>)}><CircleHelp size={16}/> Help & getting started <ArrowRight size={14}/></button><button className="profile" onClick={()=>nav('settings')}><Avatar name={name}/><span><b>{name}</b><small>Workspace owner</small></span><Settings2 size={16}/></button></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumb"><IconButton label="Open navigation" className="mobile-menu" onClick={()=>setSideOpen(true)}><Menu size={20}/></IconButton><span>Workspace</span><ChevronRight size={13}/><b>{current.label}</b></div><div className="topbar-actions"><div className="global-search"><Search size={16}/><input ref={searchRef} aria-label="Search workspace" placeholder="Search anything…" value={search} onChange={e=>{setSearch(e.target.value);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)}/><kbd><Command size={10}/> K</kbd>{searchOpen&&search&&<div className="search-results" role="region" aria-label="Search results">{results.length?results.map(r=><button key={r.key} onClick={r.action}><Search size={14}/><span>{r.label}</span><small>{r.kind}</small></button>):<p>No results for “{search}”</p>}</div>}</div><div className="topbar-divider"/><button className="demo-mode-btn" onClick={startTour} aria-label="Open guided Demo Mode"><span className="demo-switch"><span/></span><span>Demo Mode</span></button><div className="notification-wrap"><IconButton label="Open notifications" onClick={()=>setNotifications(!notifications)}><Bell size={19}/>{data.preferences.notifications==='true'&&<span className="notification-dot"/>}</IconButton>{notifications&&<div className="notification-popover"><h3>Workspace activity</h3><p>Local demo notifications</p>{data.preferences.notifications==='false'?<p>Activity alerts are paused in Settings.</p>:data.executions.slice(0,4).map(e=><button key={e.id} onClick={()=>{logs(e);setNotifications(false);}}><span className={`activity-dot ${e.status==='failed'?'red':''}`}/><span><b>{e.workflow?.name}</b><small>{e.status} · {e.source==='seed'?'Seeded sample':'Demo execution'}</small></span><ChevronRight size={14}/></button>)}<button className="notification-all" onClick={()=>nav('analytics')}>View all activity <ArrowRight size={13}/></button></div>}</div><button className="topbar-avatar" onClick={()=>nav('settings')} aria-label="Open profile settings"><Avatar name={name} size="small"/></button></div></header>
    <main id="main-content" className="main-content" tabIndex={-1}>
      {tour>0&&<div className="tour-bar"><span className="tour-label"><Play size={13} fill="currentColor"/> GUIDED SHOWCASE</span><div className="tour-progress">{['Ask SYNO','Review & approve','Run sample event','See the result'].map((s,i)=><span key={s} className={tour===i+1?'current':tour>i+1?'done':''}><b>{tour>i+1?'✓':i+1}</b>{s}</span>)}</div><div className="tour-action">{tour===3&&<Button variant="primary" onClick={()=>void act(async()=>{const result=await api<{executions:Execution[]}>('/events','POST',{event:'no_reply',contactId:'contact-aarav',workflowId:demoWorkflow});setTour(4);if(result.executions[0])logs(result.executions[0]);return result;},'Sample event processed. Inspect the execution log.')}>Trigger sample event <Play size={13}/></Button>}{tour===4&&<Button variant="primary" onClick={()=>{nav('communication');setTour(0);toast('Showcase complete. Your demo message and execution are saved.');}}>View message & finish <ArrowRight size={13}/></Button>}<IconButton label="Exit guided showcase" onClick={()=>setTour(0)}><X size={15}/></IconButton></div></div>}
      <motion.div key={page} initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{duration:.22}}><Suspense fallback={<div className="page-loading"><div className="boot-orbit"/><p>Bringing things into flow…</p></div>}>{page==='overview'?<Overview startTour={startTour}/>:page==='syno'?<Syno/>:page==='studio'?<Studio/>:page==='workflows'?<Workflows/>:page==='communication'?<Communication/>:page==='contacts'?<Contacts/>:page==='analytics'?<Analytics/>:page==='hardware'?<Hardware/>:page==='integrations'?<Integrations/>:<Settings/>}</Suspense></motion.div>
      <footer className="app-footer"><span><span className="live-dot"/> Local workspace operational</span><span>A.R.V.E.N. <span className="muted">/</span> Built for what’s next. <Badge>PRE-LAUNCH PROTOTYPE</Badge></span></footer>
    </main></div><Suspense fallback={null}>{modal}</Suspense><Toasts items={toasts}/>
  </div></AppContext.Provider></MotionConfig>;
}
