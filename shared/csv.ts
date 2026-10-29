import type { ContactInput } from './schema';
// RFC 4180-style quoted fields, including embedded commas, quotes, and newlines.
export function parseCSV(text:string):Record<string,string>[] {
  if(text.length>120000) throw new Error('CSV must be smaller than 120 KB.');
  const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;
  const source=text.replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++) {const c=source[i];
    if(c==='"') {if(quoted&&source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n') i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2) throw new Error('CSV needs a header and at least one contact.');
  const headers=rows.shift()!.map(h=>h.trim().toLowerCase());
  if(!headers.includes('name')||!headers.includes('email')) throw new Error('CSV requires name and email columns.');
  if(rows.length>100) throw new Error('Import up to 100 contacts at a time.');
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||'').trim()])));
}
export function csvContacts(text:string):ContactInput[] {
  return parseCSV(text).map(r=>({name:r.name,email:r.email,phone:r.phone||'',company:r.company||'',status:(r.status||'lead') as ContactInput['status'],tags:(r.tags||'').split('|').filter(Boolean),notes:r.notes||'',optedIn:false,followUpAt:r.followupat||null}));
}
export function exportCSV(contacts:ContactInput[]) {
  const headers=['name','email','phone','company','status','tags','notes','followUpAt'] as const;
  const cell=(value:string)=>{const safe=/^[=+\-@\t\r]/.test(value)?`'${value}`:value;return `"${safe.replaceAll('"','""')}"`;};
  return [headers.join(','),...contacts.map(c=>headers.map(h=>cell(h==='tags'?c.tags.join('|'):String(c[h]||''))).join(','))].join('\r\n');
}
