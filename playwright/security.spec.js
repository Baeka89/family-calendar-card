const { test, expect } = require('@playwright/test');
const path = require('node:path');

const payload = `Family " autofocus onfocus="window.__injected=1" data-injected="yes"><img src=x onerror="window.__injected=1"> & 'Test'`;
const fixture = `file://${path.join(process.cwd(), 'playwright', 'ha-fixture.html')}`;

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-15T10:00:00Z') });
});

async function expectNoInjectedMarkup(page, root) {
  expect(await root.evaluate(element => {
    const roots = [element, ...element.querySelectorAll('*')];
    if (element.shadowRoot) roots.push(...element.shadowRoot.querySelectorAll('*'));
    return roots.flatMap(node => [...node.attributes || []].filter(attr => /^on/i.test(attr.name) || attr.name === 'data-injected').map(attr => attr.name));
  })).toEqual([]);
  expect(await page.evaluate(() => window.__injected || 0)).toBe(0);
}

for (const view of ['month', 'week-compact', 'week-standard', 'agenda']) {
  test(`security: ${view} treats event, calendar, icon and color input as data`, async ({ page }) => {
    await page.goto(fixture);
    await page.evaluate(({ view, payload }) => window.renderCalendarCard({
      config: {
        entities: ['calendar.family', 'calendar.work'], default_view: view,
        calendar_names: { 'calendar.family': payload },
        calendar_badge_icons: { 'calendar.family': `mdi:calendar" onmouseover="window.__injected=1` },
        colors: { 'calendar.family': `red" onmouseover="window.__injected=1` },
        event_font_colors: { 'calendar.family': `black" onmouseover="window.__injected=1` },
        show_event_location: true, combine_calendars: true, event_title_prefix: 'badge_icon',
        day_badges: [{ conditions: { weekday: 0 }, icon: `mdi:calendar" onmouseover="window.__injected=1`, text: payload }]
      },
      events: Object.fromEntries(['calendar.family', 'calendar.work'].map(id => [id, [{ uid: id, summary: payload, location: payload, description: payload, start: '2026-03-15T11:00:00Z', end: '2026-03-15T12:00:00Z' }]]))
    }), { view, payload });
    const card = page.locator('family-calendar-card-legacy');
    await expect(card.locator('.calendar-container')).toBeVisible();
    await expect(card.locator('.calendar-badge-name').first()).toHaveText(payload);
    await expectNoInjectedMarkup(page, card);
    await page.evaluate(() => {
      const card = document.querySelector('family-calendar-card-legacy');
      card.showEventModal(card._events[0]);
    });
    await expect(card.locator('.modal-title')).toHaveText(payload);
    await expectNoInjectedMarkup(page, card);
  });
}

test('security: editor keeps friendly names and configuration inside their fields', async ({ page }) => {
  await page.goto(fixture);
  await page.evaluate(payload => {
    const editor = document.createElement('family-calendar-card-editor');
    editor.setConfig({ entities: ['calendar.family'], title: payload, preference_storage_key: payload, background_image_size: payload, background_image_position: payload, background_image_repeat: payload });
    editor.hass = { language: 'en', states: { 'calendar.family': { entity_id: 'calendar.family', attributes: { friendly_name: payload } } } };
    document.getElementById('app').append(editor);
  }, payload);
  const editor = page.locator('family-calendar-card-editor');
  await expect(editor.locator('#title')).toHaveValue(payload);
  await expect(editor.locator('#entity-list label')).toHaveText(payload);
  for (const name of ['preference_storage_key', 'background_image_size', 'background_image_position', 'background_image_repeat']) {
    await expect(editor.locator(`#${name}`)).toHaveValue(payload);
  }
  await expectNoInjectedMarkup(page, editor);
});

test('security: descriptions remove active content while preserving links and formatting', async ({ page }) => {
  await page.goto(fixture);
  const result = await page.evaluate(() => {
    const card = document.createElement('family-calendar-card');
    const cases = [
      '[Menu](https://example.com/a_b_c?one=1&two=2)',
      '<p><a href="https://example.com/?a=1&b=2" onclick="window.__injected=1">Safe</a><img src=x onerror="window.__injected=1"><svg onload="window.__injected=1"></svg><script>window.__injected=1</script></p>',
      '[bad](javascript:alert) <a href="javascript:alert(1)">bad</a>',
      '<p><a href="https://example.com/&quot; onmouseover=&quot;window.__injected=1">Quoted</a></p>',
      '[**Menu**](https://example.com/a_b_c) and **[link](https://example.com/a_b_c)**',
      '`<img src=x onerror="window.__injected=1"> $&` §CODESPAN0§ §FCINLINE0§'
    ];
    return cases.map(value => {
      const container = document.createElement('div');
      container.innerHTML = card.renderEventDescription(value);
      document.body.append(container);
      return {
        active: container.querySelectorAll('script, img, svg, iframe, object').length,
        events: [...container.querySelectorAll('*')].flatMap(el => [...el.attributes].filter(attr => /^on/i.test(attr.name))),
        urls: [...container.querySelectorAll('a')].map(a => a.getAttribute('href')),
        text: container.textContent,
        bold: container.querySelectorAll('strong').length
      };
    });
  });
  for (const item of result) {
    expect(item.active).toBe(0);
    expect(item.events).toEqual([]);
    expect(item.urls.every(url => !/^javascript:/i.test(url))).toBeTruthy();
  }
  expect(result[0].urls).toEqual(['https://example.com/a_b_c?one=1&two=2']);
  expect(result[1].urls).toEqual(['https://example.com/?a=1&b=2']);
  expect(result[4].bold).toBe(2);
  expect(result[5].text).toContain('§CODESPAN0§ §FCINLINE0§');
  expect(await page.evaluate(() => window.__injected || 0)).toBe(0);
});

// Exact regression reported in the HACS review: hover must remain inert.
test('security: malformed description links cannot inject hover handlers', async ({ page }) => {
  await page.goto(fixture);
  await page.evaluate(() => {
    window.renderCalendarCard({
      config: { entities: ['calendar.family'], default_view: 'agenda' },
      events: { 'calendar.family': [{ uid: 'sanitizer-regression', summary: 'Dinner', description: 'Dinner <a href="https://x/<b x">see>here</a> <a href="https://y/ onmouseover=window.__injected=1// ">menu</a>', start: '2026-03-15T11:00:00Z', end: '2026-03-15T12:00:00Z' }] }
    });
  });
  const card = page.locator('family-calendar-card-legacy');
  await card.locator('.agenda-event').filter({ hasText: 'Dinner' }).click();
  const root = card.locator('.event-description-content');
  await root.hover();
  for (const link of await root.locator('a').all()) await link.hover();
  await expectNoInjectedMarkup(page, root);
  await expect(root).toContainText('menu');
});

test('security: HTML parser rejects malformed markup and unsafe URL boundaries', async ({ page }) => {
  await page.goto(fixture);
  const result = await page.evaluate(() => {
    const card = document.createElement('family-calendar-card');
    customElements.define('description-attack', class extends HTMLElement {
      constructor() { super(); window.__injected = 1; }
    });
    const attacks = [
      '<p><description-attack>custom element</description-attack></p>',
      '<p><a href="https://x/<b x">see>here</a> <a href="https://y/ onmouseover=window.__injected=1// ">menu</a></p>',
      '<p><a href="jav&#x61;script:window.__injected=1">bad</a></p>',
      '<a href="https://example.com/&#10;x">newline</a>',
      '<a href="https://example.com/&quot;">quote</a>',
      '<a href="https://example.com/&#39;">quote</a>',
      '<svg><foreignObject><p onmouseover="window.__injected=1">bad</p></foreignObject></svg>',
      '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=window.__injected=1>">',
      '<template shadowrootmode="open"><img src=x onerror=window.__injected=1></template><p>safe</p>',
      '<p><a href="javascript:window.__injected=1" href="https://example.com/">duplicate</a></p>',
      '<p><base href="https://evil.invalid"><form id="attributes"><input name="innerHTML"></form><iframe srcdoc="<script>parent.__injected=1</script>"></iframe>safe</p>',
      '[bad](data:text/html,attack) [bad](vbscript:attack)',
      '<p><a href="https://example.com/" onclick="window.__injected=1"><b onmouseover="window.__injected=1">safe</b></a></p>'
    ];
    window.__injected = 0;
    return attacks.map(source => {
      const root = document.createElement('div');
      root.className = 'sanitizer-corpus';
      root.innerHTML = card.renderEventDescription(source);
      // Reinsertion covers browser reparsing of serialized sanitized markup.
      root.innerHTML = root.innerHTML;
      document.body.append(root);
      return [...root.querySelectorAll('*')].flatMap(node => {
        const problems = [];
        if (!'a b strong i em u s br p div ul ol li blockquote code pre h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr td th'.split(' ').includes(node.localName)) problems.push(node.outerHTML);
        for (const attr of node.attributes) if (!(node.localName === 'a' && ['href', 'target', 'rel'].includes(attr.name))) problems.push(attr.name);
        if (node.localName === 'a' && (!card.getSafeDescriptionUrl(node.getAttribute('href')) || node.rel !== 'noopener noreferrer' || node.target !== '_blank')) problems.push('unsafe anchor');
        return problems;
      });
    });
  });
  expect(result.flat()).toEqual([]);
  for (const element of await page.locator('.sanitizer-corpus a, .sanitizer-corpus b').all()) await element.hover();
  expect(await page.evaluate(() => window.__injected)).toBe(0);
});
