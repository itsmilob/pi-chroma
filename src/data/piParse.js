// Packed Pi digit format shared by the browser and the pack-pi CLI script.
//
// Layout: 16-byte header, then two digits per byte (high nibble first).
//   bytes 0-3  magic "PI4" + version 1
//   bytes 4-7  reserved
//   bytes 8-15 digit count (uint64 little endian, as lo/hi uint32)
// Digit 0 is the leading "3", digit 1 is the first decimal, and so on.

export const HEADER_BYTES = 16;
export const MAGIC = [0x50, 0x49, 0x34, 0x01];

export function hasMagic(bytes) {
  return bytes.length >= 4 && MAGIC.every((b, i) => bytes[i] === b);
}

export function writeHeader(bytes, count) {
  bytes.set(MAGIC, 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  view.setUint32(8, count % 0x100000000, true);
  view.setUint32(12, Math.floor(count / 0x100000000), true);
}

export function readHeaderCount(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES);
  return view.getUint32(8, true) + view.getUint32(12, true) * 0x100000000;
}

// Accumulates digits from text chunks (y-cruncher output, plain digit dumps)
// into the packed layout. Everything that is not 0-9 is skipped, and digits
// start at the "3" of "3.14159...".
export class DigitPacker {
  constructor(maxDigits) {
    this.bytes = new Uint8Array(HEADER_BYTES + Math.ceil(maxDigits / 2));
    this.maxDigits = maxDigits;
    this.count = 0;
    this.started = false;
    this.head = [];
    this.headLen = 0;
  }

  push(chunk) {
    if (this.started) {
      this.#consume(chunk, 0);
      return;
    }
    this.head.push(chunk);
    this.headLen += chunk.length;
    if (this.headLen >= 65536) this.#start();
  }

  finish() {
    if (!this.started) this.#start();
    const used = HEADER_BYTES + Math.ceil(this.count / 2);
    writeHeader(this.bytes, this.count);
    return this.bytes.subarray(0, used);
  }

  #start() {
    const all = new Uint8Array(this.headLen);
    let o = 0;
    for (const c of this.head) {
      all.set(c, o);
      o += c.length;
    }
    this.head = [];
    const text = new TextDecoder('latin1').decode(all.subarray(0, Math.min(all.length, 65536)));
    const at = text.search(/3\.?1415/);
    if (at === -1) throw new Error('No digits of pi found (expected 3.14159... at the start of the file)');
    this.started = true;
    this.#consume(all, at);
  }

  #consume(buf, from) {
    const bytes = this.bytes;
    let count = this.count;
    const max = this.maxDigits;
    for (let k = from; k < buf.length && count < max; k++) {
      const d = buf[k] - 48;
      if (d < 0 || d > 9) continue;
      const bi = HEADER_BYTES + (count >> 1);
      if (count & 1) bytes[bi] |= d;
      else bytes[bi] = d << 4;
      count++;
    }
    this.count = count;
  }
}
