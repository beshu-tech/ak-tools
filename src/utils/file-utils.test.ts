import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportKeyPairToZip, importKeyPairFromZip } from './file-utils'

const pair = { name: 'my-key', publicKey: '  PUBLIC\n', privateKey: '\nPRIVATE  ' }

async function zipFile(files: Record<string, string>, name: string) {
  const zip = new JSZip()
  for (const [path, body] of Object.entries(files)) zip.file(path, body)
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], name)
}

describe('exportKeyPairToZip', () => {
  afterEach(() => vi.restoreAllMocks())

  it('downloads <name>.zip with trimmed fixed-name PEM files', async () => {
    let captured: Blob | undefined
    const createObjectURL = vi.fn((b: Blob) => ((captured = b), 'blob:fake'))
    const revokeObjectURL = vi.fn()
    Object.assign(window.URL, { createObjectURL, revokeObjectURL })
    let download = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download
    })

    await exportKeyPairToZip(pair)

    expect(click).toHaveBeenCalledOnce()
    expect(download).toBe('my-key.zip')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull() // link cleaned up

    const zip = await JSZip.loadAsync(await captured!.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['private_key.pem', 'public_key.pem'])
    expect(await zip.file('public_key.pem')!.async('string')).toBe('PUBLIC')
    expect(await zip.file('private_key.pem')!.async('string')).toBe('PRIVATE')
  })
})

describe('importKeyPairFromZip', () => {
  it('reads both PEMs and names the pair after the zip file', async () => {
    const file = await zipFile({ 'public_key.pem': 'PUB', 'private_key.pem': 'PRIV' }, 'prod key.zip')
    expect(await importKeyPairFromZip(file)).toEqual({ name: 'prod key', publicKey: 'PUB', privateKey: 'PRIV' })
  })

  it.each([
    [{ 'public_key.pem': 'PUB' }],
    [{ 'private_key.pem': 'PRIV' }],
    [{ 'other.txt': 'x' }],
  ])('rejects a zip missing expected files: %j', async (files) => {
    await expect(importKeyPairFromZip(await zipFile(files, 'k.zip'))).rejects.toThrow(/Expected public_key.pem and private_key.pem/)
  })

  it('rejects a non-zip file', async () => {
    await expect(importKeyPairFromZip(new File(['not a zip'], 'k.zip'))).rejects.toThrow()
  })

  it('round-trips with export', async () => {
    let captured: Blob | undefined
    Object.assign(window.URL, { createObjectURL: (b: Blob) => ((captured = b), 'blob:x'), revokeObjectURL: () => {} })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await exportKeyPairToZip({ name: 'rt', publicKey: 'A', privateKey: 'B' })
    const back = await importKeyPairFromZip(new File([captured!], 'rt.zip'))
    expect(back).toEqual({ name: 'rt', publicKey: 'A', privateKey: 'B' })
  })
})
