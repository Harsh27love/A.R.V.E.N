import { test, expect, type Page } from '@playwright/test';

async function ready(page:Page,path='overview'){await page.goto(`/#${path}`);await expect(page.locator('main h1')).toBeVisible();await page.evaluate(()=>document.fonts.ready);}
async function reset(page:Page){await page.goto('/');await page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();await fetch('/api/reset',{method:'POST',headers:{'Content-Type':'application/json','x-arven-session':token},body:JSON.stringify({confirmed:true})});});await page.reload();await expect(page.locator('main h1')).toBeVisible();}
async function stats(page:Page){return page.evaluate(async()=>{const {token}=await(await fetch('/api/session')).json();return(await fetch('/api/stats',{headers:{'x-arven-session':token}})).json();});}

test('every navigation page loads without browser errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['overview','syno','studio','workflows','communication','contacts','analytics','hardware','integrations','settings']) {
    await ready(page,path);await expect(page.getByRole('link',{name:'Skip to content'})).toBeAttached();
    if(path==='overview')await page.screenshot({path:'docs/screenshots/01-overview.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
    if(path==='hardware')await page.screenshot({path:'docs/screenshots/05-concept-store.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
  }
  expect(errors).toEqual([]);
});

test('complete Shark Tank showcase persists the approved workflow and one demo message',async({page})=>{
  await reset(page);const before=await stats(page);
  await page.getByRole('button',{name:'Explore the demo',exact:true}).click();
  await page.getByRole('button',{name:'Start the showcase'}).click();
  await expect(page.getByLabel('Tell SYNO what to automate')).toHaveValue("Remind customers who haven't replied in three days.");
  await page.getByRole('button',{name:'Send instruction to SYNO'}).click();
  await expect(page.getByRole('button',{name:'Review in Studio'})).toBeVisible();
  await page.screenshot({path:'docs/screenshots/02-syno-proposal.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
  await page.getByRole('button',{name:'Review in Studio'}).click();
  await expect(page.getByLabel('Workflow name')).toHaveValue('Customer follow-up');
  await expect(page.locator('.flow-node')).toHaveCount(4);
  await page.getByRole('button',{name:'Review & activate',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Aarav Sharma');
  await page.getByRole('button',{name:'Approve & activate'}).click();
  await expect(page.getByRole('button',{name:'Trigger sample event'})).toBeVisible();
  await page.screenshot({path:'docs/screenshots/03-automation-studio.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
  await page.getByRole('button',{name:'Trigger sample event'}).click();
  await expect(page.getByRole('dialog')).toContainText('Demo email recorded for Aarav Sharma');
  await expect(page.getByRole('dialog')).toContainText('No external delivery was attempted');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'View message & finish'}).click();
  await expect(page.locator('.thread-messages')).toContainText('Demo — Not Sent');
  await expect(page.locator('.thread-messages')).toContainText('Hi Aarav Sharma');
  await expect(page.locator('.thread-message').last()).toBeInViewport();
  await page.screenshot({path:'docs/screenshots/04-communication-hub.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
  const after=await stats(page);expect(after.success).toBe(before.success+1);expect(after.messages).toBe(before.messages+1);expect(after.workflows).toBe(before.workflows+1);
  await page.reload();await expect(page.locator('main h1')).toBeVisible();expect((await stats(page)).messages).toBe(after.messages);
});

test('contact editing, CSV export, compose and schedule actions work',async({page})=>{
  await ready(page,'contacts');
  await page.getByRole('button',{name:'Edit Aarav Sharma',exact:true}).click();
  await page.getByLabel('Business / company').fill('Sharma Electronics & Co.');
  await page.getByLabel('Notes',{exact:true}).fill('Call on Friday about the new package.');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.contacts-table')).toContainText('Sharma Electronics & Co.');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();expect((await download).suggestedFilename()).toBe('arven-contacts.csv');
  await ready(page,'communication');
  await page.getByRole('button',{name:'Compose message'}).click();
  await page.getByLabel('Subject',{exact:true}).fill('A quick personal hello');
  await page.getByLabel('Message',{exact:true}).fill('Thanks for visiting our shop. How can we help?');
  await page.getByRole('button',{name:'Save demo message'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.thread-messages')).toContainText('A quick personal hello');
  await page.getByRole('button',{name:'Schedule follow-up',exact:true}).click();
  await page.getByLabel('Message',{exact:true}).fill('A little check-in for tomorrow.');
  await page.getByRole('button',{name:'Schedule demo message'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.thread-messages')).toContainText('A little check-in for tomorrow.');
  await page.getByRole('button',{name:'Cancel scheduled message'}).click();await expect(page.locator('.thread-messages')).toContainText('cancelled');
});

test('concept detail URL, quantities, cart totals and checkout preview work',async({page})=>{
  await ready(page,'hardware');await page.getByRole('button',{name:'View Nexus Hub details'}).click();
  await expect(page).toHaveURL(/product=nexus/);await page.reload();await expect(page.locator('main h1')).toHaveText('Nexus Hub');
  await page.getByRole('button',{name:'Add to concept cart',exact:true}).click();
  await page.getByRole('button',{name:'Add to concept cart',exact:true}).click();
  await page.getByRole('button',{name:'Open concept cart (2)',exact:true}).click();
  await expect(page.getByTestId('cart-total')).toHaveText('₹9,998');
  await page.getByRole('button',{name:'Increase Nexus Hub quantity'}).click();await expect(page.getByTestId('cart-total')).toHaveText('₹14,997');
  await page.getByRole('button',{name:'Decrease Nexus Hub quantity'}).click();await expect(page.getByTestId('cart-total')).toHaveText('₹9,998');
  await page.getByRole('button',{name:'Checkout preview',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('NO PAYMENT · NO ORDER · NO RESERVATION');
  await page.getByRole('button',{name:'Finish preview'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile navigation and layouts remain usable without page overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const path of ['overview','syno','studio','workflows','communication','contacts','analytics','hardware','integrations','settings']) {
    await ready(page,path);
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
    expect(sizes.scroll,`${path} must not overflow the mobile viewport`).toBeLessThanOrEqual(sizes.width+1);
  }
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.locator('aside.sidebar').getByRole('button',{name:'Overview',exact:true}).click();await expect(page.locator('main h1')).toContainText('A little less busy');
  await page.screenshot({path:'docs/screenshots/mobile-overview.png',fullPage:true,style:' .toasts{visibility:hidden!important}'});
});

test('keyboard search, modal focus, preferences and reset are functional',async({page})=>{
  await ready(page,'overview');await page.keyboard.press('Control+k');await expect(page.getByLabel('Search workspace',{exact:true})).toBeFocused();
  await page.getByLabel('Search workspace',{exact:true}).fill('Analytics');await page.locator('.search-results').getByRole('button').click();await expect(page.locator('main h1')).toContainText('clearer picture');
  await ready(page,'settings');await page.getByRole('switch',{name:'Reduce interface motion'}).click();await expect(page.getByRole('switch',{name:'Reduce interface motion'})).toBeChecked();
  await page.getByLabel('Your name',{exact:true}).fill('Founder');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('.profile')).toContainText('Founder');
  await page.getByRole('button',{name:'Reset demo data',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Founder');
  await page.getByRole('button',{name:'Reset demo data',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Reset demo data',exact:true}).click();await expect(page.locator('.profile')).toContainText('Alex');await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Alex');
});

test('SYNO shows the Nemotron provider and actionable connection failures without losing the instruction',async({page})=>{
  await ready(page,'syno');
  await expect(page.getByRole('button',{name:'Test connection',exact:true})).toBeDisabled();
  // UI-only availability fixture. The test server has no real provider credentials.
  await page.route('**/api/state',async route=>{const response=await route.fetch();const state=await response.json();await route.fulfill({response,json:{...state,aiConfigured:true}});});
  await page.route('**/api/ai/test',route=>route.fulfill({status:503,json:{code:'AI_MODEL_UNAVAILABLE',error:'OpenRouter has no available endpoint for nvidia/nemotron-3-ultra-550b-a55b. No alternate model was used.'}}));
  await page.route('**/api/chat',route=>route.fulfill({status:429,json:{code:'AI_RATE_LIMITED',error:'OpenRouter is rate-limiting this key or model. Wait before retrying, or use Demo Mode.'}}));
  await page.reload();await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('combobox',{name:'Assistant mode',exact:true}).selectOption('ai');
  await expect(page.locator('.chat-toolbar')).toContainText('Nemotron 3 Ultra');
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  await expect(page.locator('.toast-error')).toContainText('No alternate model was used');
  await page.getByLabel('Tell SYNO what to automate').fill('Send an appointment reminder by SMS.');
  await page.getByRole('button',{name:'Send instruction to SYNO'}).click();
  await expect(page.locator('.toast-error').last()).toContainText('rate-limiting');
  await expect(page.getByLabel('Tell SYNO what to automate')).toHaveValue('Send an appointment reminder by SMS.');
});
