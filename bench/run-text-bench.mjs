// Run text rendering benchmark on multiple browsers
// Usage: node bench/run-text-bench.mjs

import { chromium, webkit } from 'playwright';

for (let [name, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
  console.log(`\n${'='.repeat(60)}\n${name}\n${'='.repeat(60)}`)
  let browser = await launcher.launch()
  let page = await browser.newPage()

  page.on('console', msg => console.log(msg.text()))

  await page.goto('http://127.0.0.1:8777/bench/text-render-bench.html')
  await page.waitForTimeout(1000)

  // click run and wait for "Done!"
  await page.click('#run')
  await page.waitForFunction(() => document.getElementById('results').textContent.includes('Done!'), { timeout: 120000 })

  await browser.close()
}
