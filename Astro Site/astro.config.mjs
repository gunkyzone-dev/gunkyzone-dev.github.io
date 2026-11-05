import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gunkyzone-dev.github.io',
  output: 'static',
  build: {
    format: 'file',
  },
});
