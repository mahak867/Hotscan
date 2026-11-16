// Unit tests for the pricing rules. No browser and no network: these import the
// same module the app and the price endpoint use.
import { test, expect } from '@playwright/test'
import {
  MAINLINE_MRP, settleRarity, reconcile, typicalCollector, summarizeReports, reportsFitRarity,
  applyCondition, listingMatchesCar, parseRange, formatRange,
} from '../shared/pricing.js'
import { dbLookup } from '../src/pricedb.js'

test.describe('pricing rules', () => {
  test('a plastic-wheel Porsche is a mainline car, not Premium', () => {
    const car = { name: 'Porsche 911 GT3 RS', rarity: 'Premium', wheel_type: '10-spoke plastic', series: 'HW Exotics' }
    expect(settleRarity(car)).not.toBe('Premium')
    const p = reconcile(car, { india_retail_inr: '800-1500', india_collector_inr: '1500-3500' })
    expect(p.india_retail_inr).toBe(MAINLINE_MRP)
    expect(parseRange(p.india_collector_inr)[1]).toBeLessThanOrEqual(2000)
  })

  test('rubber tyres or a premium card make a car Premium', () => {
    expect(settleRarity({ name: 'Nissan Skyline', rarity: 'Common', wheel_type: 'Real Riders rubber 5-spoke' })).toBe('Premium')
    expect(settleRarity({ name: 'BMW 2002', rarity: 'Common', series: 'Car Culture: Deutschland Design' })).toBe('Premium')
  })

  test('chase tiers keep their rarity and sell at mainline shelf price', () => {
    const sth = { name: 'Bone Shaker', rarity: 'Super Treasure Hunt', wheel_type: 'Real Riders' }
    expect(settleRarity(sth)).toBe('Super Treasure Hunt')
    const p = reconcile(sth, { india_retail_inr: '700-1000', india_collector_inr: '6000-9000' })
    expect(p.india_retail_inr).toBe(MAINLINE_MRP)
    expect(p.india_collector_inr).toBe('6000-9000')
    expect(p.clamped).toBe(false)
  })

  test('an implausible price is pulled back inside the rarity limits', () => {
    const p = reconcile({ name: 'Rod Squad', rarity: 'Common' }, { india_collector_inr: '4000-9000' })
    expect(p.clamped).toBe(true)
    expect(parseRange(p.india_collector_inr)[1]).toBeLessThanOrEqual(1500)
  })

  test('no price data gives the typical range and says so', () => {
    const p = reconcile({ name: 'Rod Squad', rarity: 'Common' }, {})
    expect(p.estimated).toBe(true)
    expect(p.india_collector_inr).toBe(typicalCollector('Common', 'Rod Squad'))
    // sought-after castings sit higher in the same band
    expect(parseRange(typicalCollector('Common', 'Nissan Skyline GT-R'))[0]).toBeGreaterThan(parseRange(typicalCollector('Common', 'Rod Squad'))[0])
  })

  test('community reports: outliers dropped, middle half quoted', () => {
    const s = summarizeReports([250, 280, 300, 320, 350, 4000])
    expect(s.dropped).toBe(1)
    expect(s.max).toBe(350)
    expect(s.low).toBeGreaterThanOrEqual(250)
    expect(s.high).toBeLessThanOrEqual(350)
  })

  test('mainline reports are not applied to a Super Treasure Hunt', () => {
    const s = summarizeReports([250, 280, 300, 320])
    expect(reportsFitRarity(s, 'Common')).toBe(true)
    expect(reportsFitRarity(s, 'Super Treasure Hunt')).toBe(false)
    expect(reportsFitRarity(summarizeReports([300, 320]), 'Common')).toBe(false) // too few
  })

  test('condition scales the carded price', () => {
    expect(applyCondition('1000-2000', 'carded')).toBe('1000-2000')
    expect(applyCondition('1000-2000', 'loose')).toBe('600-1200')
    expect(applyCondition('1000-2000', 'played')).toBe('300-600')
  })

  test('prices are rounded the way sellers quote them', () => {
    expect(formatRange(212, 287)).toBe('210-290')
    expect(formatRange(4380, 4380)).toBe('4400')
  })

  test('scraped listings: lots and other castings are rejected', () => {
    expect(listingMatchesCar('Hot Wheels Bone Shaker 2023 carded', 'Bone Shaker')).toBe(true)
    expect(listingMatchesCar('Hot Wheels lot of 20 cars with Bone Shaker', 'Bone Shaker')).toBe(false)
    expect(listingMatchesCar('Hot Wheels Twin Mill', 'Bone Shaker')).toBe(false)
    expect(listingMatchesCar('Bone Shaker toy car', 'Bone Shaker')).toBe(false) // not stated as Hot Wheels
  })

  test('reference table respects rarity', () => {
    expect(dbLookup('Twin Mill', 'Common')).toBeNull()          // only a Redline row exists
    expect(dbLookup('Twin Mill', 'Vintage')).not.toBeNull()
    expect(dbLookup('Bone Shaker', 'Common')).not.toBeNull()
    expect(dbLookup('Bone Shaker', 'Super Treasure Hunt')).toBeNull()
  })
})

import { carStyle, carPaint, carArt } from '../src/carart.js'
test.describe('car artwork', () => {
  test('body style follows the casting name', () => {
    expect(carStyle("'69 Camaro")).toBe('muscle')
    expect(carStyle('Porsche 911 GT3 RS')).toBe('super')
    expect(carStyle('Ford F-150 Raptor')).toBe('truck')
    expect(carStyle('Volkswagen Kombi')).toBe('van')
    expect(carStyle('Bone Shaker')).toBe('rod')
    expect(carStyle('Honda Civic Type R')).toBe('coupe')
  })
  test('paint follows the recorded colour, and is stable without one', () => {
    expect(carPaint({ color: 'Spectraflame Blue' })).toBe('#2f6fe4')
    expect(carPaint({ name: 'Rod Squad' })).toBe(carPaint({ name: 'Rod Squad' }))
    expect(carArt({ name: 'Twin Mill', color: 'red', rarity: 'Vintage' })).toContain('<svg')
  })
})
