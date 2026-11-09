import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OFFLINE_CAP_TICKS } from '../src/core/balance'
import { createInitialState } from '../src/core/state'
import { SAVE_VERSION, deserialize, offlineTicks, serialize, type Save } from '../src/save/serialize'
import { SaveCodeError, decodeImport, decodeSave, encodeSave, normalizeCode } from '../src/save/codec'

const fixtures = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((v) => [
  v,
  readFileSync(`tests/fixtures/save-v${v}.json`, 'utf8'),
] as const)

/** the legacy plain-base64 export the pre-batch-23 SaveTransfer produced (standard alphabet, padded) */
function legacyCode(saveFile: Save): string {
  const bytes = new TextEncoder().encode(JSON.stringify(saveFile))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

describe('encodeSave / decodeSave', () => {
  it('round-trips every fixture save and a fresh v19 deepEqual', () => {
    const saves: Save[] = fixtures.map(([, raw]) => deserialize(raw)!)
    saves.push(JSON.parse(serialize(createInitialState(), 123)) as Save)
    for (const save of saves) {
      const code = encodeSave(save)
      expect(code).toMatch(/^TILES1\.[A-Za-z0-9-_]+\.[0-9a-f]{8}$/)
      expect(decodeSave(code)).toEqual(save)
    }
  })

  it('decodeImport reports the version the code was exported at, before migration', () => {
    const v15 = deserialize(readFileSync('tests/fixtures/save-v15.json', 'utf8'))!
    const { save, fromVersion } = decodeImport(encodeSave(v15))
    expect(fromVersion).toBe(save.version).toBe(SAVE_VERSION) // encode re-serialises the migrated Save
    const v18 = JSON.parse(readFileSync('tests/fixtures/save-v18.json', 'utf8')) as Save
    expect(decodeImport(encodeSave(v18)).fromVersion).toBe(18)
  })

  it('every prefix of a valid code throws cleanly — none half-loads', () => {
    const code = encodeSave(deserialize(fixtures[17]![1])!)
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
    expect(() => decodeSave(encodeSave({ ...save, version: SAVE_VERSION + 1 }))).toThrowError(
      expect.objectContaining({ tag: 'newer-version' }),
    )
    expect(() => decodeSave(legacyCode({ ...save, version: SAVE_VERSION + 7 }))).toThrowError(
      expect.objectContaining({ tag: 'newer-version' }),
    )
    for (const junk of ['', 'hello world', 'https://example.com', btoa('{"hello":1}')])
      expect(() => decodeSave(junk), JSON.stringify(junk)).toThrowError(expect.objectContaining({ tag: 'not-tiles' }))
  })

  it('legacy plain-base64 codes (padded, standard alphabet) decode with the same version gate', () => {
    const v11 = readFileSync('tests/fixtures/save-v11.json', 'utf8')
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
  for (const v of [13, 14, 15, 16, 17, 18]) {
    it(`code-v${v}.txt decodes to save-v${v}.json migrated, and encode is byte-stable`, () => {
      const raw = readFileSync(`tests/fixtures/save-v${v}.json`, 'utf8')
      const code = readFileSync(`tests/fixtures/code-v${v}.txt`, 'utf8').trimEnd()
      const { save, fromVersion } = decodeImport(code)
      expect(fromVersion).toBe(v)
      expect(save).toEqual(deserialize(raw))
      expect(encodeSave(JSON.parse(raw) as Save)).toBe(code)
    })
  }
})
