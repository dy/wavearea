// Headless benchmark runner using Playwright
import { chromium } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.map': 'application/json',
  '.mp3': 'audio/mpeg',
  '.css': 'text/css',
};

// Simple static server
const server = createServer((req, res) => {
  const filePath = join(root, req.url === '/' ? 'bench/decode-bench.html' : req.url);
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 9876;
server.listen(PORT);

const testFile = process.argv[2] || join(root, 'birds-forest.mp3');
const fileSize = statSync(testFile).size;
console.log(`\nBenchmarking: ${testFile} (${(fileSize / 1024 / 1024).toFixed(2)} MB)\n`);

const browser = await chromium.launch();
const page = await browser.newPage();

// Collect logs
page.on('console', msg => {
  if (msg.type() === 'error') console.error('  [browser]', msg.text());
});

await page.goto(`http://localhost:${PORT}/bench/decode-bench.html`);

// Upload file via input
const input = await page.$('#fileInput');
await input.setInputFiles(testFile);

// Wait for file info
await page.waitForFunction(() => document.getElementById('fileInfo').textContent.length > 0);

// Run 3x average
const results = await page.evaluate(async () => {
  // Trigger the benchmark logic directly
  const { MPEGDecoder } = await import('./bench/bench.js').catch(() => ({}));

  const file = document.getElementById('fileInput').files[0];
  const arrayBuffer = await file.arrayBuffer();

  async function benchDecodeAudioData(buf) {
    const b = buf.slice(0);
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const t0 = performance.now();
    const ab = await ctx.decodeAudioData(b);
    const total = performance.now() - t0;
    return { name: 'decodeAudioData', total, firstChunk: total, samples: ab.length, sampleRate: ab.sampleRate, channels: ab.numberOfChannels };
  }

  // We need to click the button and read results from log
  return null;
});

// Actually just click the 3x button and read the log
await page.click('#runAllBtn');

// Wait for completion — log should contain "Averaged"
await page.waitForFunction(
  () => document.getElementById('log').textContent.includes('Averaged'),
  { timeout: 120000 }
);

const logText = await page.$eval('#log', el => el.textContent);
console.log(logText);

// Extract table data
const tableData = await page.$$eval('#results tbody tr', rows =>
  rows.map(tr => Array.from(tr.cells).map(td => td.textContent.trim()))
);

console.log('\n┌─────────────────────┬────────────┬──────────────┬─────────────┬───────┬────┬───────────┐');
console.log('│ Decoder             │ Total (ms) │ First (ms)   │ Samples     │ Rate  │ Ch │ Realtime  │');
console.log('├─────────────────────┼────────────┼──────────────┼─────────────┼───────┼────┼───────────┤');
for (const row of tableData) {
  console.log(`│ ${row.map((c, i) => c.padStart(i === 0 ? -19 : [10, 12, 11, 5, 2, 9][i - 1])).join(' │ ')} │`);
}
console.log('└─────────────────────┴────────────┴──────────────┴─────────────┴───────┴────┴───────────┘');

await browser.close();
server.close();
