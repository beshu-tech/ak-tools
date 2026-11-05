import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLocalStorageCollection, type StorableItem } from './use-local-storage-collection'

interface Thing extends StorableItem {
  label: string
}
const KEY = 'things'
const opts = (defaultItems?: Thing[]) => ({ storageKey: KEY, entityName: 'things', defaultItems })
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null')
const seed = (items: Thing[]) => localStorage.setItem(KEY, JSON.stringify(items))
const thing = (id: string, label = id): Thing => ({ id, label, createdAt: '2026-01-01T00:00:00.000Z' })

describe('useLocalStorageCollection', () => {
  it('starts loading then settles empty when storage is empty and no defaults', async () => {
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('loads saved items', async () => {
    seed([thing('a'), thing('b')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('seeds defaults and persists them when storage is empty', async () => {
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts([thing('d')])))
    await waitFor(() => expect(result.current.items).toEqual([thing('d')]))
    expect(stored()).toEqual([thing('d')])
  })

  it('re-seeds defaults when the saved array is empty', async () => {
    seed([])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts([thing('d')])))
    await waitFor(() => expect(result.current.items).toEqual([thing('d')]))
  })

  it('does not overwrite saved items with defaults', async () => {
    seed([thing('saved')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts([thing('d')])))
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['saved']))
    expect(stored().map((i: Thing) => i.id)).toEqual(['saved'])
  })

  it('falls back to defaults and exposes an error on corrupt JSON', async () => {
    localStorage.setItem(KEY, '{not json')
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts([thing('d')])))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.items).toEqual([thing('d')])
  })

  it('add assigns id + createdAt, appends and persists', async () => {
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let created!: Thing
    act(() => {
      created = result.current.add({ label: 'new' })
    })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(created.createdAt).toString()).not.toBe('Invalid Date')
    expect(result.current.items).toEqual([created])
    expect(stored()).toEqual([created])
    expect(result.current.getById(created.id)).toEqual(created)
  })

  it('update merges fields but never changes id or createdAt', async () => {
    seed([thing('a', 'old'), thing('b')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.update('a', { label: 'new' }))
    expect(result.current.getById('a')).toEqual({ ...thing('a'), label: 'new' })
    expect(result.current.getById('b')).toEqual(thing('b'))
    expect(stored()[0].label).toBe('new')
  })

  it('update with an unknown id is a no-op', async () => {
    seed([thing('a')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    act(() => result.current.update('zzz', { label: 'x' }))
    expect(result.current.items).toEqual([thing('a')])
  })

  it('remove deletes and persists; getById then returns undefined', async () => {
    seed([thing('a'), thing('b')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    act(() => result.current.remove('a'))
    expect(result.current.items.map((i) => i.id)).toEqual(['b'])
    expect(stored().map((i: Thing) => i.id)).toEqual(['b'])
    expect(result.current.getById('a')).toBeUndefined()
  })

  it('applies several operations in one batch consistently', async () => {
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => {
      result.current.add({ label: 'one' })
      result.current.add({ label: 'two' })
    })
    expect(result.current.items.map((i) => i.label)).toEqual(['one', 'two'])
    expect(stored()).toHaveLength(2)
  })

  it('keeps in-memory state when a storage write fails', async () => {
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    act(() => {
      result.current.add({ label: 'x' })
    })
    expect(result.current.items).toHaveLength(1)
  })

  // KNOWN BUG: persist() (and its setError) runs inside a setState updater,
  // an impure side effect. Whether `error` is surfaced depends on whether React
  // runs the updater eagerly or during render, so it is unreliable.
  // Fix by persisting in an effect, then turn this into a real test.
  it.todo('surfaces a storage write failure as `error`')

  it('keeps callbacks referentially stable across renders', async () => {
    const { result, rerender } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const { add, update, remove } = result.current
    rerender()
    expect(result.current.add).toBe(add)
    expect(result.current.update).toBe(update)
    expect(result.current.remove).toBe(remove)
  })

  it('isolates collections by storageKey', async () => {
    localStorage.setItem('other', JSON.stringify([thing('o')]))
    seed([thing('a')])
    const { result } = renderHook(() => useLocalStorageCollection<Thing>(opts()))
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a']))
  })
})
