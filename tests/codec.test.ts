import { deflateRawSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { OFFLINE_CAP_TICKS } from '../src/core/balance'
import { createInitialState } from '../src/core/state'
import { SAVE_VERSION, deserialize, offlineTicks, serialize, type Save } from '../src/save/serialize'
import { MAX_INFLATED_BYTES, SaveCodeError, crc32hex, decodeImport, decodeSave, encodeSave, encodeSaveCompact, normalizeCode } from '../src/save/codec'
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
import v37Raw from './fixtures/save-v37.json?raw'
import codeV38 from './fixtures/code-v38.txt?raw'

/** the SaveCodeError tag a code rejects with, or null when it decodes */
async function tagOf(code: string): Promise<string | null> {
  try {
    await decodeSave(code)
    return null
  } catch (e) {
    return e instanceof SaveCodeError ? e.tag : `not a SaveCodeError: ${String(e)}`
  }
}

const fixtures = [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13Raw, v14Raw, v15Raw, v16Raw, v17Raw, v18Raw, v19Raw] as const

/** the legacy plain-base64 export the pre-batch-23 SaveTransfer produced (standard alphabet, padded) */
function legacyCode(saveFile: Save): string {
  const bytes = new TextEncoder().encode(JSON.stringify(saveFile))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

describe('encodeSave / decodeSave', () => {
  it('round-trips every fixture save and a fresh v20 deepEqual', async () => {
    const saves: Save[] = fixtures.map((raw) => deserialize(raw)!)
    saves.push(JSON.parse(serialize(createInitialState(), 123)) as Save)
    for (const [i, save] of saves.entries()) {
      const code = encodeSave(save)
      expect(code, `fixture #${i}`).toMatch(/^TILES1\.[A-Za-z0-9-_]+\.[0-9a-f]{8}$/)
      expect(await decodeSave(code), `fixture #${i}`).toEqual(save)
    }
  })

  it('decodeImport reports the version the code was exported at, before migration', async () => {
    const v15 = deserialize(v15Raw)!
    const { save, fromVersion } = await decodeImport(encodeSave(v15))
    expect(fromVersion).toBe(SAVE_VERSION) // encode re-serialises the migrated Save
    expect(save.version).toBe(SAVE_VERSION)
    expect((await decodeImport(encodeSave(JSON.parse(v18Raw) as Save))).fromVersion).toBe(18)
  })

  it('every prefix of a valid code throws cleanly — none half-loads', async () => {
    const code = encodeSave(deserialize(v18Raw)!)
    for (let len = 0; len < code.length; len++) {
      expect(await tagOf(code.slice(0, len)), `prefix ${len} of ${code.length}`).not.toBeNull()
    }
  })

  it('a damaged body is corrupt, a future save is newer-version, junk is not-tiles', async () => {
    const save = JSON.parse(serialize(createInitialState(), 0)) as Save
    const code = encodeSave(save)
    const bodyStart = 'TILES1.'.length
    const flip = code[bodyStart] === 'A' ? 'B' : 'A'
    const damaged = `${code.slice(0, bodyStart)}${flip}${code.slice(bodyStart + 1)}`
    expect(await tagOf(damaged)).toBe('corrupt')
    expect(await tagOf(encodeSave({ ...save, version: SAVE_VERSION + 1 } as Save))).toBe('newer-version')
    expect(await tagOf(legacyCode({ ...save, version: SAVE_VERSION + 7 } as Save))).toBe('newer-version')
    for (const junk of ['', 'hello world', 'https://example.com', btoa('{"hello":1}')])
      expect(await tagOf(junk), JSON.stringify(junk)).toBe('not-tiles')
  })

  it('legacy plain-base64 codes (padded, standard alphabet) decode with the same version gate', async () => {
    const code = legacyCode(JSON.parse(v11) as Save)
    expect(await decodeSave(code)).toEqual(deserialize(v11))
    // a paste that picked up line breaks, backticks and the code fence still decodes
    expect(await decodeSave(`\`\`\`\n  ${code.slice(0, 40)}\n${code.slice(40)} \`\`\``)).toEqual(deserialize(v11))
  })

  it('normalizeCode strips whitespace/backticks/padding and maps the standard alphabet', () => {
    expect(normalizeCode(' a+/b=c ` ')).toBe('a-_bc')
  })

  it('offline-cap behaviour is unchanged: the codec carries savedAtMs, offlineTicks still caps', async () => {
    const save = JSON.parse(serialize(createInitialState(), 0)) as Save
    expect((await decodeSave(encodeSave(save))).savedAtMs).toBe(0)
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
    it(`code-v${v}.txt decodes to save-v${v}.json migrated, and encode is byte-stable`, async () => {
      const { save, fromVersion } = await decodeImport(code.trimEnd())
      expect(fromVersion).toBe(v)
      expect(save).toEqual(deserialize(raw))
      expect(encodeSave(JSON.parse(raw) as Save)).toBe(code.trimEnd())
    })
  }
})

/** a TILES2 envelope around arbitrary deflate-raw bytes, with a valid checksum (Node's zlib stands in for any encoder) */
function tiles2(packed: Uint8Array): string {
  const body = Buffer.from(packed).toString('base64url')
  return `TILES2.${body}.${crc32hex(body)}`
}

describe('TILES2: deflate-raw codes (batch 39)', () => {
  it('round-trips every fixture save and is at least 3× shorter than TILES1 on the late-game v37 fixture', async () => {
    const saves: Save[] = fixtures.map((raw) => deserialize(raw)!)
    saves.push(deserialize(v37Raw)!)
    for (const [i, save] of saves.entries()) {
      const code = await encodeSaveCompact(save)
      expect(code, `fixture #${i}`).toMatch(/^TILES2\.[A-Za-z0-9-_]+\.[0-9a-f]{8}$/)
      expect(await decodeSave(code), `fixture #${i}`).toEqual(save)
    }
    const late = deserialize(v37Raw)!
    expect(encodeSave(late).length / (await encodeSaveCompact(late)).length).toBeGreaterThan(3)
  })

  it('frozen code-v38.txt (the first TILES2 export) decodes to save-v37.json migrated — decode only, deflate bytes vary by engine', async () => {
    const { save, fromVersion } = await decodeImport(codeV38.trimEnd())
    expect(fromVersion).toBe(38)
    expect(save).toEqual(deserialize(v37Raw))
  })

  it('a code from another deflate engine (Node zlib) decodes: the format is plain deflate-raw', async () => {
    const save = deserialize(v37Raw)!
    expect(await decodeSave(tiles2(deflateRawSync(JSON.stringify(save), { level: 9 })))).toEqual(save)
  })

  it('every 97th prefix rejects cleanly, a damaged body is corrupt, a non-deflate body is corrupt', async () => {
    const code = codeV38.trimEnd()
    for (let len = 0; len < code.length; len += 97) expect(await tagOf(code.slice(0, len)), `prefix ${len}`).not.toBeNull()
    const at = 'TILES2.'.length + 10
    const damaged = `${code.slice(0, at)}${code[at] === 'A' ? 'B' : 'A'}${code.slice(at + 1)}`
    expect(await tagOf(damaged)).toBe('corrupt')
    expect(await tagOf(tiles2(new TextEncoder().encode('not deflate at all')))).toBe('corrupt')
    expect(await tagOf(tiles2(deflateRawSync('{"hello":1}')))).toBe('corrupt')
  })

  it('a newer version inside a TILES2 code is newer-version', async () => {
    const save = { ...deserialize(v37Raw)!, version: SAVE_VERSION + 1 }
    expect(await tagOf(tiles2(deflateRawSync(JSON.stringify(save))))).toBe('newer-version')
  })

  it(`a code that inflates past MAX_INFLATED_BYTES (${MAX_INFLATED_BYTES}) is refused as corrupt, not loaded`, async () => {
    const bomb = deflateRawSync(Buffer.alloc(MAX_INFLATED_BYTES + 1024, 0x20))
    expect(bomb.length).toBeLessThan(10_000)
    expect(await tagOf(tiles2(bomb))).toBe('corrupt')
  })

  it('without Compression/DecompressionStream: export falls back to TILES1, a TILES2 paste is unsupported', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    vi.stubGlobal('DecompressionStream', undefined)
    try {
      const save = deserialize(v37Raw)!
      const code = await encodeSaveCompact(save)
      expect(code).toBe(encodeSave(save))
      expect(await tagOf(codeV38.trimEnd())).toBe('unsupported')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
