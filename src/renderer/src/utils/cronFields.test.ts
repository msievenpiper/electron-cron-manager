import { describe, it, expect } from 'vitest'
import { parseCronToFields, buildCronFromFields } from './cronFields'

describe('parseCronToFields', () => {
  it('parses a standard 5-part expression', () => {
    expect(parseCronToFields('0 9 * * 1')).toEqual({
      minute: '0', hour: '9', dom: '*', month: '*', dow: '1',
    })
  })

  it('falls back step fields to *', () => {
    expect(parseCronToFields('*/5 * * * *').minute).toBe('*')
  })

  it('falls back range fields to *', () => {
    expect(parseCronToFields('0 9-17 * * *').hour).toBe('*')
  })

  it('falls back list fields to *', () => {
    expect(parseCronToFields('0 0 * * 1,3,5').dow).toBe('*')
  })

  it('returns all * for invalid expression', () => {
    expect(parseCronToFields('not valid')).toEqual({
      minute: '*', hour: '*', dom: '*', month: '*', dow: '*',
    })
  })
})

describe('buildCronFromFields', () => {
  it('joins 5 fields with spaces', () => {
    expect(buildCronFromFields({ minute: '0', hour: '9', dom: '*', month: '*', dow: '1' }))
      .toBe('0 9 * * 1')
  })

  it('handles all wildcards', () => {
    expect(buildCronFromFields({ minute: '*', hour: '*', dom: '*', month: '*', dow: '*' }))
      .toBe('* * * * *')
  })
})
