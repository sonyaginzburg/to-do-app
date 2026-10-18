import { describe, expect, it } from 'vitest'
import { addDays, formatRange, startOfWeek, weekDays } from './dates'

describe('dates', () => {
  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19') // Monday
    expect(startOfWeek('2026-10-15')).toBe('2026-10-12') // Thursday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12') // Sunday belongs to the week before
  })

  it('lists seven consecutive days', () => {
    expect(weekDays('2026-10-12')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ])
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formats a range, including one that spans two years', () => {
    expect(formatRange('2026-10-12')).toBe('Oct 12 – Oct 18, 2026')
    expect(formatRange('2026-12-28')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})
