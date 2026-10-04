const generatedBanner = '// This file is generated from src/ by npm run build. Do not edit directly.';

export default {
  input: 'src/family-calendar-card.js',
  treeshake: false,
  output: {
    file: 'family-calendar-card.js',
    format: 'es',
    banner: generatedBanner,
    sourcemap: false
  }
};
