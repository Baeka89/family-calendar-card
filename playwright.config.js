const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  
  use: {
    viewport: { width: 1400, height: 1000 },
    colorScheme: 'light'
  }
});
