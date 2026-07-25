import { test, expect } from '@playwright/test'

test.describe('Hotscan basic smoke test', () => {
  test('homepage loads with correct title and scanner visible', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/HotScan/)
    await expect(page.locator('#page-scan')).toBeVisible()
  })

  test('sidebar navigation is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#hs-sidebar')).toBeVisible()
    await expect(page.locator('#sb-collection')).toBeVisible()
  })

  test('sign-in flow opens without error', async ({ page }) => {
    await page.goto('/')
    // Go to a page that shows the Sign In button when signed out
    await page.locator('#sb-collection').click()
    var signInBtn = page.getByText('Sign In / Create Account')
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click()
      // Auth modal or sign-in page should appear — just confirm no crash,
      // don't attempt real OAuth in an automated test
      await page.waitForTimeout(500)
    }
  })

  test('no console errors on initial load', async ({ page }) => {
    var errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await page.waitForTimeout(1500)
    expect(errors, 'Uncaught JS errors on page load: ' + errors.join('; ')).toEqual([])
  })
})
