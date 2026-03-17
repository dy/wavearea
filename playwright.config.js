import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testIgnore: '**/unit/**',
  timeout: 30000,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:8777',
    headless: true,
  },
  webServer: {
    command: 'npx esbuild ./src/wavearea.js ./src/worker.js ./src/layers/layers.js --bundle --splitting --sourcemap --loader:.svg=text --loader:.html=text --loader:.woff2=file --format=esm --outdir=dist --servedir=. --serve=8777 --external:@audio/aiff-decode --external:@audio/caf-decode --external:@audio/webm-decode --external:@audio/amr-decode --external:@audio/wma-decode --entry-names=[name]',
    port: 8777,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' }, timeout: 60000 },
  ],
});
