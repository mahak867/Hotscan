import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.TEST_URL || 'https://www.hotscan.in',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // model-health.spec.js is a pure API check (no browser rendering
    // involved) — running it on both projects fired the same requests at
    // the same GROQ_API_KEY_1 nearly simultaneously from 2 parallel workers,
    // which is what caused the 429s. It only needs to run once.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] }, testIgnore: '**/model-health.spec.js' },
  ],
})
