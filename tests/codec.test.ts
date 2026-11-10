import { describe, expect, it } from 'vitest'
import { OFFLINE_CAP_TICKS } from '../src/core/balance'
import { createInitialState } from '../src/core/state'
import { SAVE_VERSION, deserialize, offlineTicks, serialize, type Save } from '../src/save/serialize'
import { SaveCodeError, decodeImport, decodeSave, encodeSave, normalizeCode } from '../src/save/codec'
import v1 from './fixtures/save-v1.json?raw'
import v2 from './fixtures/save-v2.json?raw'
import v3 from './fixtures/save-v3.json?raw'
import v4 from './fixtures/save-v4.json?raw'
import v5 from './fixtures/save-v5.json?raw'
import v6 from './fixtures/save-v6.json?raw'
import v7 from './fixtures/save-v7.json?raw'
import v8 from './fixtures/save-v8.json?raw'
import v9 from './fixtures/save-v9.json?raw'
import v10 from './fixtures/save-v10.json?raw'
import v11 from './fixtures/save-v11.json?raw'
import v12 from './fixtures/save-v12.json?raw'
import v13Raw from './fixtures/save-v13.json?raw'
import v14Raw from './fixtures/save-v14.json?raw'
import v15Raw from './fixtures/save-v15.json?raw'
import v16Raw from './fixtures/save-v16.json?raw'
import v17Raw from './fixtures/save-v17.json?raw'
import v18Raw from './fixtures/save-v18.json?raw'
import v19Raw from './fixtures/save-v19.json?raw'
import codeV13 from './fixtures/code-v13.txt?raw'
import codeV14 from './fixtures/code-v14.txt?raw'
import codeV15 from './fixtures/code-v15.txt?raw'
import codeV16 from './fixtures/code-v16.txt?raw'
import codeV17 from './fixtures/code-v17.txt?raw'
import codeV18 from './fixtures/code-v18.txt?raw'
import codeV19 from './fixtures/code-v19.txt?raw'

const fixtures = [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13Raw, v14Raw, v15Raw, v16Raw, v17Raw, v18Raw, v19Raw] as const

/** the legacy plain-base64 export the pre-batch-23 SaveTransfer produced (standard alphabet, padded) */
function legacyCode(saveFile: Save): string {
  const bytes = new TextEncoder().encode(JSON.stringify(saveFile))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

describe('encodeSave / decodeSave', () => {
  it('round-trips every fixture save and a fresh v20 deepEqual', () => {
    const saves: Save[] = fixtures.map((raw) => deserialize(raw)!)
    saves.push(JSON.parse(serialize(createInitialState(), 123)) as Save)
    for (const [i, save] of saves.entries()) {
      const code = encodeSave(save)
      expect(code, `fixture #${i}`).toMatch(/^TILES1\.[A-Za-z0-9-_]+\.[0-9a-f]{8}$/)
      expect(decodeSave(code), `fixture #${i}`).toEqual(save)
    }
  })

  it('decodeImport reports the version the code was exported at, before migration', () => {
    const v15 = deserialize(v15Raw)!
    const { save, fromVersion } = decodeImport(encodeSave(v15))
    expect(fromVersion).toBe(SAVE_VERSION) // encode re-serialises the migrated Save
    expect(save.version).toBe(SAVE_VERSION)
    expect(decodeImport(encodeSave(JSON.parse(v18Raw) as Save)).fromVersion).toBe(18)
  })

  it('every prefix of a valid code throws cleanly — none half-loads', () => {
    const code = encodeSave(deserialize(v18Raw)!)
    for (let len = 0; len < code.length; len++) {
      const cut = code.slice(0, len)
      let thrown: unknown
      try {
        decodeSave(cut)
      } catch (e) {
        thrown = e
      }
      expect(thrown, `prefix ${len} of ${code.length}`).toBeInstanceOf(SaveCodeError)
    }
  })

  it('a damaged body is corrupt, a future save is newer-version, junk is not-tiles', () => {
    const save = JSON.parse(serialize(createInitialState(), 0)) as Save
    const code = encodeSave(save)
    const bodyStart = 'TILES1.'.length
    const flip = code[bodyStart] === 'A' ? 'B' : 'A'
    const damaged = `${code.slice(0, bodyStart)}${flip}${code.slice(bodyStart + 1)}`
    expect(() => decodeSave(damaged)).toThrowError(expect.objectContaining({ tag: 'corrupt' }))
    expect(() => decodeSave(encodeSave({ ...save, version: SAVE_VERSION + 1 } as Save))).toThrowError(
      expect.objectContaining({ tag: 'newer-version' }),
    )
    expect(() => decodeSave(legacyCode({ ...save, version: SAVE_VERSION + 7 } as Save))).toThrowError(
      expect.objectContaining({ tag: 'newer-version' }),
    )
    for (const junk of ['', 'hello world', 'https://example.com', btoa('{"hello":1}')])
      expect(() => decodeSave(junk), JSON.stringify(junk)).toThrowError(expect.objectContaining({ tag: 'not-tiles' }))
  })

  it('legacy plain-base64 codes (padded, standard alphabet) decode with the same version gate', () => {
    const code = legacyCode(JSON.parse(v11) as Save)
    expect(decodeSave(code)).toEqual(deserialize(v11))
    // a paste that picked up line breaks, backticks and the code fence still decodes
    expect(decodeSave(`\`\`\`\n  ${code.slice(0, 40)}\n${code.slice(40)} \`\`\``)).toEqual(deserialize(v11))
  })

  it('normalizeCode strips whitespace/backticks/padding and maps the standard alphabet', () => {
    expect(normalizeCode(' a+/b=c ` ')).toBe('a-_bc')
  })

  it('offline-cap behaviour is unchanged: the codec carries savedAtMs, offlineTicks still caps', () => {
    const save = JSON.parse(serialize(createInitialState(), 0)) as Save
    expect(decodeSave(encodeSave(save)).savedAtMs).toBe(0)
    expect(offlineTicks(10 * 24 * 3600 * 1000)).toBe(OFFLINE_CAP_TICKS)
  })
})

describe('frozen export fixtures (v13–v18)', () => {
  // what encode produces from each past schema fixture, frozen so the migrate chain stays importable forever
  const frozen: Record<number, readonly [raw: string, code: string]> = {
    13: [v13Raw, codeV13],
    14: [v14Raw, codeV14],
    15: [v15Raw, codeV15],
    16: [v16Raw, codeV16],
    17: [v17Raw, codeV17],
    18: [v18Raw, codeV18],
    19: [v19Raw, codeV19],
  }
  for (const [v, [raw, code]] of Object.entries(frozen).map(([n, pair]) => [Number(n), pair] as const)) {
    it(`code-v${v}.txt decodes to save-v${v}.json migrated, and encode is byte-stable`, () => {
      const { save, fromVersion } = decodeImport(code.trimEnd())
      expect(fromVersion).toBe(v)
      expect(save).toEqual(deserialize(raw))
      expect(encodeSave(JSON.parse(raw) as Save)).toBe(code.trimEnd())
    })
  }
})
