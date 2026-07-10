// Shared test base — caps the engine's resident-PCM budget per page.
// Full-budget detection (quota-derived, up to GBs per instance) balloons
// parallel test runs; 64MB forces OPFS paging, which is also worth exercising.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => { window.__budget = 64 * 1024 * 1024 });
    await use(context);
  },
});
export { expect };
