const {test,expect}=require('@playwright/test');
const path=require('path');
for(const view of ['month','week','week-compact','week-standard','agenda']){
  test(`Hidden calendar badges apply in ${view}`,async({page})=>{
    await page.goto('file://'+path.join(process.cwd(),'playwright/ha-fixture.html'));
    await page.evaluate(view=>{
      const d=new Date();
      const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      d.setDate(d.getDate()+1);
      const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const event={uid:'hidden-badge',summary:'Waste collection badge test',start:{date},end:{date:end}};
      window.renderCalendarCard({config:{entities:['calendar.waste'],default_view:view,event_title_prefix:'badge',hide_badge_calendars:['calendar.waste']},events:{'calendar.waste':[event]}});
    },view);
    const card=page.locator('family-calendar-card-legacy');
    await expect(card.getByText('Waste collection badge test',{exact:true}).first()).toBeVisible();
    await expect(card.locator('.calendar-badge,.event-title-prefix-badge,.week-standard-event-icon,.combined-corner-bubble')).toHaveCount(0);
  });
}
