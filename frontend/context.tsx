import { createContext, useContext, type ReactNode } from 'react';
import type { Workspace } from './api';
import type { Execution, Stats, WorkflowInput } from '../shared/schema';
export const pages=['overview','syno','studio','workflows','communication','contacts','analytics','hardware','integrations','settings'] as const;
export type Page=typeof pages[number];
export type Editable=WorkflowInput & {id?:string;status?:string};
export type AppContextType={
  data:Workspace;stats:Stats;page:Page;search:string;setSearch:(s:string)=>void;nav:(p:Page)=>void;
  refresh:()=>Promise<void>;toast:(message:string,error?:boolean)=>void;
  act:<T>(fn:()=>Promise<T>,success?:string)=>Promise<T|undefined>;
  modal:(node:ReactNode)=>void;closeModal:()=>void;
  confirm:(title:string,description:string,fn:()=>Promise<unknown>,label?:string,danger?:boolean)=>void;
  edit:(w?:Editable)=>void;editing:Editable|null;setEditing:(w:Editable|null)=>void;
  logs:(e:Execution)=>void;prompt:string;setPrompt:(s:string)=>void;
  tour:number;setTour:(n:number)=>void;demoWorkflow:string;setDemoWorkflow:(id:string)=>void;
};
export const AppContext=createContext<AppContextType|null>(null);
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('Workspace is not ready.');return value;}
