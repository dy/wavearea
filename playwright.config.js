import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:8777',
    headless: true,
  },
  webServer: {
    command: 'npx esbuild ./src/wavearea.js ./src/worker.js --bundle --splitting --sourcemap --loader:.svg=text --loader:.html=text --loader:.woff2=file --format=esm --outdir=dist --servedir=. --serve=8777 --external:@audio/*',
    port: 8777,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
