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
  //
  // Progress comes from the file's own header, not content-length: servers
  // gzip the download, so content-length counts compressed bytes while the
  // stream delivers decompressed ones, and received / content-length ran past
  // 100%.
  static async fromUrl(url, onProgress = () => {}, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) return null;
    if ((res.headers.get('content-type') || '').includes('text/html')) return null;

    const reader = res.body.getReader();
    let head = new Uint8Array(0); // bytes seen before the header is complete
    let target = null;
    let written = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;

      if (!target) {
        const joined = new Uint8Array(head.length + chunk.length);
        joined.set(head, 0);
        joined.set(chunk, head.length);
        head = joined;
        if (head.length < HEADER_BYTES) continue;
        if (!hasMagic(head)) {
          await reader.cancel();
          return null;
        }
        target = new Uint8Array(HEADER_BYTES + Math.ceil(readHeaderCount(head) / 2));
        chunk = head;
        head = null;
      }

      if (written + chunk.length > target.length) {
        throw new Error('Packed Pi file is longer than its header says');
      }
      target.set(chunk, written);
      written += chunk.length;
      onProgress(Math.min(1, written / target.length));
    }

    if (!target) return null;
    return PiStore.fromPacked(target); // rejects a truncated download
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
