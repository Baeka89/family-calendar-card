const {test,expect}=require('@playwright/test');
const path=require('path');

async function renderAgenda(page,{compact=false,daysWithEvents=3}={}) {
  await page.evaluate(({compact,daysWithEvents})=>{
    const dateAt=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    window.renderCalendarCard({parentStyle:'height: 900px;',config:{entities:['calendar.family'],default_view:'agenda',rolling_days_agenda:2,compact_height:compact,hide_empty_days:true,hide_header:true,hide_calendars:true},events:{'calendar.family':Array.from({length:daysWithEvents},(_,i)=>({uid:`event-${i}`,summary:`Agenda event ${i}`,start:{date:dateAt(i)},end:{date:dateAt(i+1)}}))}});
  },{compact,daysWithEvents});
  await expect(page.locator('.agenda-event')).toHaveCount(daysWithEvents);
}

for(const width of [390,1100])test(`Agenda follows visible content instead of a tall allocation at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1100});
  await page.goto('file://'+path.join(process.cwd(),'playwright/ha-fixture.html'));
  await renderAgenda(page);
  const card=page.locator('family-calendar-card-legacy');
  const threeDays=await card.boundingBox();
  expect(threeDays.height).toBeLessThan(600);
  await expect(card.locator('.agenda-day-row')).toHaveCount(3);
  const lastRow=await card.locator('.agenda-day-row').last().boundingBox();
  expect(threeDays.y+threeDays.height-lastRow.y-lastRow.height).toBeLessThan(35);
  await renderAgenda(page,{daysWithEvents:1});
  const oneDay=await card.boundingBox();
  expect(oneDay.height).toBeLessThan(threeDays.height-80);
  await renderAgenda(page,{daysWithEvents:0});
  expect((await card.boundingBox()).height).toBeLessThan(oneDay.height);
  await renderAgenda(page,{compact:true});
  expect((await card.boundingBox()).height).toBeGreaterThanOrEqual(899);
});
