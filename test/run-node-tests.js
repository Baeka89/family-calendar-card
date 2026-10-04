import { spawnSync } from 'node:child_process';

const testFiles = [
  'family-calendar-card.test.js',
  'ha-state-helpers.test.mjs',
  'color-config-normalizers.test.mjs'
];

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, TZ: 'UTC' }
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
