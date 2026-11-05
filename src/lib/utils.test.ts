import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class values', () => expect(cn('a', false, null, undefined, 'b')).toBe('a b'))
  it('supports conditional objects and arrays', () =>
    expect(cn(['a', { b: true, c: false }])).toBe('a b'))
  it('lets later Tailwind utilities win over conflicting earlier ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
    expect(cn('bg-red-500', 'bg-primary')).toBe('bg-primary')
  })
  it('keeps non-conflicting utilities', () => expect(cn('px-2', 'py-4')).toBe('px-2 py-4'))
  it('merges variants separately', () => expect(cn('hover:p-2', 'p-4')).toBe('hover:p-2 p-4'))
})
