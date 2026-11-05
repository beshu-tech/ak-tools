import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getJwtMetadata } from '../utils/activationKey'
import { useKeyPairs } from './use-key-pairs'
import { useTemplates } from './use-templates'

describe('useTemplates', () => {
  it('seeds the built-in Anaphora example on first run, and it is a decodable key', async () => {
    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.templates).toHaveLength(1))
    const [t] = result.current.templates
    expect(t.id).toBe('default-anaphora-free')
    expect(t.name).toBe('Anaphora Free Edition')
    expect(getJwtMetadata(t.activationKey)?.algorithm).toBe('ES512')
    expect(JSON.parse(localStorage.getItem('akTemplates')!)).toHaveLength(1)
  })

  it('does not re-seed after the user deleted everything? (documents current behaviour)', async () => {
    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.templates).toHaveLength(1))
    act(() => result.current.deleteTemplate('default-anaphora-free'))
    expect(result.current.templates).toHaveLength(0)
    // storage now holds [] → next load re-seeds the default
    const again = renderHook(() => useTemplates())
    await waitFor(() => expect(again.result.current.templates).toHaveLength(1))
  })

  it('add / update / get / delete round trip under the akTemplates key', async () => {
    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let created!: ReturnType<typeof result.current.addTemplate>
    act(() => {
      created = result.current.addTemplate({ name: 'N', description: 'D', activationKey: 'a.b.c' })
    })
    expect(result.current.getTemplateById(created.id)).toMatchObject({ name: 'N', description: 'D' })
    act(() => result.current.updateTemplate(created.id, { name: 'N2' }))
    expect(result.current.getTemplateById(created.id)?.name).toBe('N2')
    expect(JSON.parse(localStorage.getItem('akTemplates')!).some((t: { name: string }) => t.name === 'N2')).toBe(true)
    act(() => result.current.deleteTemplate(created.id))
    expect(result.current.getTemplateById(created.id)).toBeUndefined()
  })
})

describe('useKeyPairs', () => {
  it('starts empty (no defaults) and persists under keyPairs', async () => {
    const { result } = renderHook(() => useKeyPairs())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.keyPairs).toEqual([])
    let created!: ReturnType<typeof result.current.addKeyPair>
    act(() => {
      created = result.current.addKeyPair({ name: 'k', publicKey: 'pub', privateKey: 'priv' })
    })
    expect(result.current.getKeyPairById(created.id)).toEqual(created)
    expect(JSON.parse(localStorage.getItem('keyPairs')!)).toEqual([created])
    act(() => result.current.updateKeyPair(created.id, { name: 'renamed' }))
    expect(result.current.keyPairs[0].name).toBe('renamed')
    act(() => result.current.deleteKeyPair(created.id))
    expect(result.current.keyPairs).toEqual([])
  })
})
