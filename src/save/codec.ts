// TILES1 save-codec (docs/research/save-import-export.md): code := "TILES1." base64url(json) "." crc32-8hex.
// Pure and sync: no DOM beyond TextEncoder/TextDecoder, no wall clock, no storage. The schema version stays
// inside the JSON; the CRC is over the base64url TEXT, so a cut paste fails before any decode.
import { SAVE_VERSION, deserialize, type Save } from './serialize'

export type DecodeTag = 'not-tiles' | 'truncated' | 'corrupt' | 'newer-version'

export class SaveCodeError extends Error {
  constructor(readonly tag: DecodeTag) {
    super(tag)
    this.name = 'SaveCodeError'
  }
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
// accepts the standard alphabet too, so a legacy plain-base64 export decodes through the same table
const REV = (() => {
  const rev = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64URL.length; i++) rev[B64URL.charCodeAt(i)] = i
  rev['+'.charCodeAt(0)] = 62
  rev['/'.charCodeAt(0)] = 63
  return rev
})()

/** bytes → unpadded base64url, in 12 kB chunks so no single string op holds the whole save twice over */
function toB64Url(bytes: Uint8Array): string {
  let out = ''
  for (let start = 0; start < bytes.length; start += 0x3000) {
    let chunk = ''
    const end = Math.min(start + 0x3000, bytes.length)
    for (let i = start; i < end; i += 3) {
      const b0 = bytes[i]!
      const b1 = i + 1 < end ? bytes[i + 1]! : -1
      const b2 = i + 2 < end ? bytes[i + 2]! : -1
      chunk += B64URL[b0 >> 2]
      chunk += B64URL[((b0 & 3) << 4) | (b1 === -1 ? 0 : b1 >> 4)]
      if (b1 === -1) break
      chunk += B64URL[((b1 & 15) << 2) | (b2 === -1 ? 0 : b2 >> 6)]
      if (b2 === -1) break
      chunk += B64URL[b2 & 63]
    }
    out += chunk
  }
  return out
}

/** unpadded base64url text → bytes; null for any character outside the alphabet (padding accepted) */
function fromB64Url(text: string): Uint8Array | null {
  const out = new Uint8Array(((text.length * 3) >> 2) + 3)
  let bits = 0
  let acc = 0
  let len = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    const v = c < 128 ? (REV[c] ?? -1) : -1
    if (v === -1) return null
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[len++] = (acc >> bits) & 0xff
    }
  }
  // 6 leftover bits = a dangling single char; 4 or 2 are the legal 2/3-char tails
  return bits === 6 ? null : out.subarray(0, len)
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
    t[i] = c
  }
  return t
})()

/** CRC-32 (IEEE) of the text's UTF-8 bytes as 8 lowercase hex — the code's checksum and the save ID */
export function crc32hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = (CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)) >>> 0
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

export function encodeSave(saveFile: Save): string {
  const body = toB64Url(new TextEncoder().encode(JSON.stringify(saveFile)))
  return `TILES1.${body}.${crc32hex(body)}`
}

/** trims what a paste picks up: whitespace, markdown backticks, standard-alphabet +/ and = padding */
export function normalizeCode(text: string): string {
  return text.replace(/[+/]/g, (c) => (c === '+' ? '-' : '_')).replace(/[\s`=]/g, '')
}

function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function rawVersion(raw: string): unknown {
  try {
    return (JSON.parse(raw) as { version?: unknown } | null)?.version
  } catch {
    return undefined
  }
}

export type DecodedImport = { save: Save; fromVersion: number }

/**
 * Any code this game ever exported: `TILES1.` envelope or legacy plain base64 (what SaveTransfer shipped before
 * batch 23). Migrates through the boot deserialize chain, so there is no second validator. Throws SaveCodeError
 * with `truncated` (cut paste), `corrupt` (checksum/decode failed), `newer-version` (from a future build) or
 * `not-tiles` (a legacy paste that is not a save at all).
 */
export function decodeImport(code: string): DecodedImport {
  const text = normalizeCode(code)
  const tiles = text.startsWith('TILES1.')
  let raw: string | null
  if (tiles) {
    const rest = text.slice('TILES1.'.length)
    const dot = rest.indexOf('.')
    if (dot < 1) throw new SaveCodeError('truncated')
    const body = rest.slice(0, dot)
    const check = rest.slice(dot + 1)
    // a cut checksum is a prefix shorter than 8 hex; 8 hex that do not match is corruption
    if (!/^[0-9a-f]{8}$/.test(check)) throw new SaveCodeError('truncated')
    if (check !== crc32hex(body)) throw new SaveCodeError('corrupt')
    const bytes = fromB64Url(body)
    raw = bytes === null ? null : utf8(bytes)
    if (raw === null) throw new SaveCodeError('corrupt')
  } else {
    const bytes = fromB64Url(text)
    raw = bytes === null ? null : utf8(bytes)
    if (raw === null) throw new SaveCodeError('not-tiles')
  }
  const version = rawVersion(raw)
  if (typeof version === 'number' && version > SAVE_VERSION) throw new SaveCodeError('newer-version')
  const save = deserialize(raw)
  if (!save) throw new SaveCodeError(tiles ? 'corrupt' : 'not-tiles')
  return { save, fromVersion: typeof version === 'number' ? version : save.version }
}

export function decodeSave(code: string): Save {
  return decodeImport(code).save
}
