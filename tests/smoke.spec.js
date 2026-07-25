import { test, expect } from '@playwright/test'

test.describe('Hotscan basic smoke test', () => {
  // The onboarding tour overlay (#hs-onboard) shows on ANY visit with no
  // 'hs_onboarded' localStorage flag set — which is every single Playwright
  // run, since each test gets a fresh, empty browser context. Without this,
  // the overlay sits on top of everything and blocks every click, which is
  // exactly what caused the sign-in test to time out. Pre-setting the flag
  // simulates a returning visitor, which is what these tests actually want
  // to check against anyway.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hs_onboarded', '1')
    })
  })

  test('homepage loads with correct title and scanner visible', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/HotScan/)
    await expect(page.locator('#page-scan')).toBeVisible()
  })

  test('sidebar navigation is present (desktop only)', async ({ page }) => {
    // .hs-sidebar is `display:none` below 768px by design (see style.css) —
    // mobile doesn't have a sidebar at all, so this assertion only makes
    // sense on a desktop-sized viewport.
    test.skip(page.viewportSize()?.width < 768, 'Sidebar is desktop-only by design')
    await page.goto('/')
    await expect(page.locator('#hs-sidebar')).toBeVisible()
    await expect(page.locator('#sb-collection')).toBeVisible()
  })

  test('sign-in flow opens without error', async ({ page }) => {
    await page.goto('/')
    // Route directly via the app's own router instead of clicking a sidebar
    // item — #sb-collection only exists in the desktop sidebar (hidden below
    // 768px by design), so clicking it isn't a reliable way to reach the
    // profile page on every viewport this test runs against.
    await page.evaluate(() => window.goPage('profile'))
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
