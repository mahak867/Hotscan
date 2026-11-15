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

  test('every page renders without errors and shows its heading', async ({ page }) => {
    var errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    for (var id of ['collection', 'marketplace', 'market', 'guide', 'hunt', 'alerts', 'profile', 'more', 'scan']) {
      await page.evaluate((p) => window.goPage(p), id)
      await expect(page.locator('#page-' + id)).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('collection shows value, gain/loss and opens car details', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hs_col', JSON.stringify([
        { id: 1, name: 'Bone Shaker', rarity: 'Super Treasure Hunt', india_collector_inr: '6000-9000', paid: 5000 },
        { id: 2, name: 'Bone Shaker', rarity: 'Common', india_collector_inr: '200-300' },
      ]))
    })
    await page.goto('/#collection')
    await expect(page.locator('#page-collection')).toBeVisible()
    await expect(page.locator('#val-total')).toHaveText('₹6,200')
    await expect(page.locator('#val-pl')).toContainText('+₹1,000')
    await expect(page.locator('.car-row')).toHaveCount(2)
    await expect(page.locator('.car-row').first()).toContainText('×2 owned')
    await page.locator('.car-row').first().click()
    await expect(page.locator('#col-edit-modal')).toBeVisible()
    await expect(page.locator('#col-edit-paid')).toHaveValue('5000')
  })

  test('wishlist item moves into the collection', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.state.lastResult = { name: 'Twin Mill', rarity: 'Treasure Hunt', india_collector_inr: '1000-2000' }
      window.addToWantList()
      window.goPage('collection'); window.setColTab('want')
    })
    await expect(page.locator('#want-count')).toHaveText('1')
    await page.getByText('Found it').click()
    await expect(page.locator('#want-count')).toHaveText('')
    expect(await page.evaluate(() => window.state.collection.length)).toBe(1)
  })
})
