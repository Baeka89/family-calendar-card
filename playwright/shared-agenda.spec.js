const {test,expect}=require('@playwright/test');
const path=require('path');
for(const compact of [false,true])for(const width of [390,1100])test(`agenda badges stay below time · compact=${compact} width=${width}`,async({page})=>{
 await page.setViewportSize({width,height:950});
 await page.goto('file://'+path.join(process.cwd(),'playwright/ha-fixture.html'));
 await page.evaluate(({compact})=>{
  const now=new Date(),day=now.toISOString().slice(0,10),events={},entities=Array.from({length:12},(_,i)=>'calendar.person_'+i);
  for(const id of entities)events[id]=[{uid:'shared',summary:'Gemeinsamer Familientermin mit langer Überschrift',start:day+'T10:00:00Z',end:day+'T11:00:00Z'}];
  window.renderCalendarCard({config:{entities,language:'de',default_view:'agenda',agenda_compact_events:compact,agenda_text_alignment:'left',combine_calendars:true,event_styles:[{match:{title:"Gemeinsamer Familientermin"},style:{background_color:"#345678"}}],calendar_names:Object.fromEntries(entities.map((id,i)=>[id,'Person '+i])),colors:Object.fromEntries(entities.map((id,i)=>[id,['#e56b6f','#4f86c6','#52b788'][i%3]]))},events});
 },{compact});
 const e=page.locator('.agenda-event').first();await expect(e).toBeVisible();
 const geometry=await e.evaluate(el=>{const t=el.querySelector('.agenda-event-time'),b=el.querySelector('.combined-corner-bubbles'),title=el.querySelector('.agenda-event-title');return {time:t?.getBoundingClientRect().toJSON(),badges:b?.getBoundingClientRect().toJSON(),event:el.getBoundingClientRect().toJSON(),alignment:getComputedStyle(title).textAlign,count:b?.children.length};});
 expect(geometry.count).toBe(12);expect(geometry.badges.top).toBeGreaterThanOrEqual(geometry.time.bottom);expect(geometry.badges.right).toBeLessThanOrEqual(geometry.event.right);expect(geometry.badges.bottom).toBeLessThanOrEqual(geometry.event.bottom);expect(geometry.alignment).toBe('left');
 await e.screenshot({path:test.info().outputPath(`agenda-${compact?'compact':'normal'}-${width}.png`)});
});
test('shared assignments synchronize across isolated browser contexts',async({browser})=>{
 const contexts=[await browser.newContext(),await browser.newContext()];const pages=await Promise.all(contexts.map(c=>c.newPage()));let assignments={};const clients=[];
 for(const page of pages){await page.exposeFunction('sharedSet',async msg=>{for(const key of msg.keys)if(msg.calendars.length)assignments[key]=msg.calendars;else delete assignments[key];for(const p of clients)await p.evaluate(state=>window.sharedListener?.({assignments:state}),assignments);return {assignments};});await page.goto('file://'+path.join(process.cwd(),'playwright/ha-fixture.html'));await page.evaluate(()=>{window.renderCalendarCard({config:{entities:['calendar.family','calendar.work'],enable_event_management:false},events:{}});const c=document.querySelector('family-calendar-card-legacy');c.hass={...c._hass,callWS:window.sharedSet,connection:{subscribeMessage:async callback=>{window.sharedListener=callback;return ()=>{window.sharedListener=null;};}}};});clients.push(page)}
 const event={entityId:'calendar.family',uid:'invite',start:'2026-10-08T10:00:00Z'};
 await pages[0].evaluate(async event=>{await document.querySelector('family-calendar-card-legacy').saveEventDisplayCalendars(event,['calendar.work']);},event);
 expect(await pages[1].evaluate(event=>document.querySelector('family-calendar-card-legacy').applyEventDisplayCalendars(event).sourceCalendars.map(c=>c.entityId),event)).toEqual(['calendar.family','calendar.work']);
 await pages[1].evaluate(async event=>{await document.querySelector('family-calendar-card-legacy').saveEventDisplayCalendars(event,[]);},event);
 expect(await pages[0].evaluate(()=>document.querySelector('family-calendar-card-legacy')._eventDisplayCalendars)).toEqual({});for(const context of contexts)await context.close();
});
