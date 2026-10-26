import {
  HEADER_BYTES,
  DigitPacker,
  hasMagic,
  readHeaderCount,
  writeHeader,
} from './piParse.js';

const latin1 = new TextDecoder('latin1');

// Random-access, read-only store of Pi digits packed two per byte.
// 1 billion digits take ~500 MB. It mirrors the bits of the String API the
// views use (length, charAt, charCodeAt, slice), so callers can treat it like
// the old digit string.
export class PiStore {
  constructor(bytes, length) {
    this.bytes = bytes;
    this.length = length;
    this.scratch = new Uint8Array(0);
  }

  static fromString(text) {
    const digits = text.replace(/[^0-9]/g, '');
    const bytes = new Uint8Array(HEADER_BYTES + Math.ceil(digits.length / 2));
    for (let i = 0; i < digits.length; i++) {
      const d = digits.charCodeAt(i) - 48;
      const bi = HEADER_BYTES + (i >> 1);
      if (i & 1) bytes[bi] |= d;
      else bytes[bi] = d << 4;
    }
    writeHeader(bytes, digits.length);
    return new PiStore(bytes, digits.length);
  }

  static fromPacked(bytes) {
    if (!hasMagic(bytes) || bytes.length < HEADER_BYTES) {
      throw new Error('Not a packed Pi file');
    }
    const length = readHeaderCount(bytes);
    if (bytes.length < HEADER_BYTES + Math.ceil(length / 2)) {
      throw new Error('Packed Pi file is truncated');
    }
    return new PiStore(bytes, length);
  }

  // Accepts either a packed .pi4 file or a text file of digits
  // (e.g. y-cruncher output). `onProgress` receives a 0-1 fraction.
  static async fromFile(file, onProgress = () => {}) {
    const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (hasMagic(magic)) {
      onProgress(0.5);
      const store = PiStore.fromPacked(new Uint8Array(await file.arrayBuffer()));
      onProgress(1);
      return store;
    }

    const packer = new DigitPacker(file.size);
    const reader = file.stream().getReader();
    let read = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      packer.push(value);
      read += value.length;
      onProgress(read / file.size);
    }
    return PiStore.fromPacked(packer.finish());
  }

  // Downloads a packed .pi4 file. Resolves to null if the URL does not serve
  // one (a dev server's SPA fallback answers 200 with index.html).
  static async fromUrl(url, onProgress = () => {}, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) return null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) return null;

    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const parts = [];
    let received = 0;
    let written = 0;
    let checked = false;
    let target = total ? new Uint8Array(total) : null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!checked) {
        if (value.length < 4 || !hasMagic(value)) {
          await reader.cancel();
          return null;
        }
        checked = true;
      }
      if (target && !parts.length && written + value.length <= target.length) {
        target.set(value, written);
        written += value.length;
      } else {
        parts.push(value);
      }
      received += value.length;
      onProgress(total ? received / total : 0);
    }
    if (!checked) return null;

    if (!target || parts.length) {
      // Unknown or wrong content-length: assemble from the pieces we have.
      const all = new Uint8Array(received);
      let o = 0;
      if (target) {
        all.set(target.subarray(0, written), 0);
        o = written;
      }
      for (const p of parts) {
        all.set(p, o);
        o += p.length;
      }
      target = all;
    }
    return PiStore.fromPacked(target);
  }

  digit(i) {
    const b = this.bytes[HEADER_BYTES + (i >> 1)];
    return i & 1 ? b & 15 : b >> 4;
  }

  charCodeAt(i) {
    return i >= 0 && i < this.length ? 48 + this.digit(i) : NaN;
  }

  charAt(i) {
    return i >= 0 && i < this.length ? String.fromCharCode(48 + this.digit(i)) : '';
  }

  // Writes ASCII digits for [start, end) into `out`; returns the count.
  fillAscii(start, end, out) {
    const b = this.bytes;
    let i = start;
    let o = 0;
    if (i & 1 && i < end) {
      out[o++] = 48 + (b[HEADER_BYTES + (i >> 1)] & 15);
      i++;
    }
    const pairsEnd = i + ((end - i) & ~1);
    for (; i < pairsEnd; i += 2) {
      const v = b[HEADER_BYTES + (i >> 1)];
      out[o++] = 48 + (v >> 4);
      out[o++] = 48 + (v & 15);
    }
    if (i < end) out[o++] = 48 + (b[HEADER_BYTES + (i >> 1)] >> 4);
    return o;
  }

  slice(start = 0, end = this.length) {
    start = Math.max(0, Math.min(this.length, start));
    end = Math.max(start, Math.min(this.length, end));
    const n = end - start;
    if (n === 0) return '';
    if (this.scratch.length < n) this.scratch = new Uint8Array(Math.max(n, this.scratch.length * 2));
    const written = this.fillAscii(start, end, this.scratch);
    return latin1.decode(this.scratch.subarray(0, written));
  }
}
