import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCrudState } from './use-crud-state'

interface Item {
  id: string
  name: string
  createdAt: string
}
const EMPTY = { name: '' }
const a: Item = { id: 'a', name: 'A', createdAt: '' }
const b: Item = { id: 'b', name: 'B', createdAt: '' }
const setup = () => renderHook(() => useCrudState<Item, { name: string }>({ emptyItem: EMPTY }))

describe('useCrudState', () => {
  it('starts idle', () => {
    const { result } = setup()
    expect(result.current).toMatchObject({ isAddingNew: false, newItem: EMPTY, editingId: null, editingItem: null })
  })

  it('startAdding enters add mode and cancels any edit', () => {
    const { result } = setup()
    act(() => result.current.startEditing(a))
    act(() => result.current.startAdding())
    expect(result.current.isAddingNew).toBe(true)
    expect(result.current.editingId).toBeNull()
    expect(result.current.editingItem).toBeNull()
  })

  it('startEditing enters edit mode and cancels add mode', () => {
    const { result } = setup()
    act(() => result.current.startAdding())
    act(() => result.current.startEditing(a))
    expect(result.current.isAddingNew).toBe(false)
    expect(result.current.editingId).toBe('a')
    expect(result.current.editingItem).toBe(a)
  })

  it('cancelAdding and resetNew both clear the draft and leave add mode', () => {
    for (const fn of ['cancelAdding', 'resetNew'] as const) {
      const { result } = setup()
      act(() => result.current.startAdding())
      act(() => result.current.setNewItem({ name: 'draft' }))
      expect(result.current.newItem.name).toBe('draft')
      act(() => result.current[fn]())
      expect(result.current.isAddingNew).toBe(false)
      expect(result.current.newItem).toEqual(EMPTY)
    }
  })

  it('cancelEditing clears the edit', () => {
    const { result } = setup()
    act(() => result.current.startEditing(a))
    act(() => result.current.cancelEditing())
    expect(result.current.editingId).toBeNull()
    expect(result.current.editingItem).toBeNull()
  })

  it('toggleEdit starts, switches, then cancels on the same item', () => {
    const { result } = setup()
    act(() => result.current.toggleEdit(a))
    expect(result.current.editingId).toBe('a')
    act(() => result.current.toggleEdit(b))
    expect(result.current.editingId).toBe('b')
    act(() => result.current.toggleEdit(b))
    expect(result.current.editingId).toBeNull()
    expect(result.current.editingItem).toBeNull()
  })

  it('setEditingItem updates the working copy without changing editingId', () => {
    const { result } = setup()
    act(() => result.current.startEditing(a))
    act(() => result.current.setEditingItem((prev) => (prev ? { ...prev, name: 'changed' } : null)))
    expect(result.current.editingItem?.name).toBe('changed')
    expect(result.current.editingId).toBe('a')
  })
})
