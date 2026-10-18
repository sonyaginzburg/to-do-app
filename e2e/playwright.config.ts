import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    // Fixed locale and time zone so dates and month names are the same on every machine.
    locale: 'en-US',
    timezoneId: 'UTC',
    // Wide enough that all nine board columns are on screen, so drags can reach every column
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
})
