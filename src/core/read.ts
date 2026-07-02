import { readFileSync, statSync } from 'node:fs';

/** Maximum accepted payload size in bytes (10 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type DetectedEncoding =
  | 'utf-8'
  | 'utf-8 (BOM)'
  | 'utf-16le (BOM)'
  | 'utf-16be (BOM)'
  | 'utf-16le'
  | 'utf-16be';

export interface PayloadFile {
  /** Parsed JSON value. */
  data: unknown;
  /** Encoding the file was detected and decoded as. */
  encoding: DetectedEncoding;
}

/** Error with a stable code so callers can distinguish failure modes. */
export class ReadError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'NOT_A_FILE'
      | 'TOO_LARGE'
      | 'UNREADABLE'
      | 'BAD_ENCODING'
      | 'BAD_JSON',
    message: string
  ) {
    super(message);
    this.name = 'ReadError';
  }
}

function swapBytes(buf: Buffer): Buffer {
  const out = Buffer.from(buf); // copy, do not mutate the input
  out.swap16();
  return out;
}

/**
 * Detects the encoding of a JSON buffer and decodes it to a string.
 *
 * Handles UTF-8 (with and without BOM) and UTF-16 LE/BE (with and without
 * BOM). The official samm-cli tooling emits UTF-16, so real-world battery
 * passport files frequently arrive that way. BOM-less UTF-16 is detected
 * heuristically via the zero-byte pattern of the first two bytes, which is
 * reliable for JSON because a JSON document must start with an ASCII
 * character.
 */
export function decodeJsonBuffer(
  buf: Buffer,
  context: string
): { text: string; encoding: DetectedEncoding } {
  let encoding: DetectedEncoding;
  let body: Buffer;
  let needsSwap = false; // big-endian input must be byte-swapped for TextDecoder('utf-16le')

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    encoding = 'utf-8 (BOM)';
    body = buf.subarray(3);
  } else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = 'utf-16le (BOM)';
    body = buf.subarray(2);
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = 'utf-16be (BOM)';
    body = buf.subarray(2);
    needsSwap = true;
  } else if (buf.length >= 2 && buf[0] !== 0x00 && buf[1] === 0x00) {
    // ASCII char followed by a zero byte: BOM-less UTF-16 little-endian.
    encoding = 'utf-16le';
    body = buf;
  } else if (buf.length >= 2 && buf[0] === 0x00 && buf[1] !== 0x00) {
    // Zero byte followed by an ASCII char: BOM-less UTF-16 big-endian.
    encoding = 'utf-16be';
    body = buf;
    needsSwap = true;
  } else {
    encoding = 'utf-8';
    body = buf;
  }

  // Check the odd-length case before any byte swapping: Buffer.swap16() throws
  // a raw RangeError on odd-length buffers, which would bypass the ReadError
  // contract and surface a cryptic internals message to the user.
  const isUtf16 = encoding.startsWith('utf-16');
  if (isUtf16 && body.length % 2 !== 0) {
    throw new ReadError(
      'BAD_ENCODING',
      `${context}: file looks like UTF-16 (${encoding}) but has an odd number of bytes`
    );
  }
  if (needsSwap) {
    body = swapBytes(body);
  }

  try {
    const decoder = new TextDecoder(isUtf16 ? 'utf-16le' : 'utf-8', { fatal: true });
    return { text: decoder.decode(body), encoding };
  } catch {
    throw new ReadError(
      'BAD_ENCODING',
      `${context}: file is not valid ${isUtf16 ? 'UTF-16' : 'UTF-8'} ` +
        `(detected encoding: ${encoding}). Supported encodings: UTF-8 and UTF-16 LE/BE, with or without BOM.`
    );
  }
}

/** Parses JSON with an error message that includes the source context. */
export function parseJsonText(text: string, context: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    // V8 SyntaxError messages include "at position N (line L column C)".
    const detail = err instanceof Error ? err.message : String(err);
    throw new ReadError('BAD_JSON', `${context}: invalid JSON: ${detail}`);
  }
}

/**
 * Reads and parses a JSON payload file with encoding detection.
 * Throws ReadError with a clear, path-carrying message on any failure.
 * Refuses files larger than 10 MB.
 */
export function readPayload(filePath: string): PayloadFile {
  let size: number;
  try {
    const st = statSync(filePath);
    if (!st.isFile()) {
      throw new ReadError('NOT_A_FILE', `${filePath}: not a regular file`);
    }
    size = st.size;
  } catch (err) {
    if (err instanceof ReadError) throw err;
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw new ReadError('NOT_FOUND', `${filePath}: file not found`);
    }
    throw new ReadError('UNREADABLE', `${filePath}: cannot access file (${e.message})`);
  }

  if (size > MAX_FILE_SIZE) {
    throw new ReadError(
      'TOO_LARGE',
      `${filePath}: file is ${(size / (1024 * 1024)).toFixed(1)} MB, ` +
        `refusing to read files larger than 10 MB`
    );
  }

  let buf: Buffer;
  try {
    buf = readFileSync(filePath);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new ReadError('UNREADABLE', `${filePath}: cannot read file (${e.message})`);
  }

  const { text, encoding } = decodeJsonBuffer(buf, filePath);
  const data = parseJsonText(text, filePath);
  return { data, encoding };
}
