import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL ||= 'file:./dev.db';
export const db = new PrismaClient();
export const readWorkflow = <T extends {definition:string}>(w:T) => ({...w, definition:JSON.parse(w.definition)});
export const readContact = <T extends {tags:string}>(c:T) => ({...c,tags:JSON.parse(c.tags)});
export const readExecution = <T extends {logs:string}>(e:T) => ({...e,logs:JSON.parse(e.logs)});
export const readChat = <T extends {proposal:string|null}>(c:T) => ({...c,proposal:c.proposal ? JSON.parse(c.proposal):null});
