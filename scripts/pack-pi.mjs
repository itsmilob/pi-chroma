#!/usr/bin/env node
// Packs a text file of pi digits (y-cruncher output, a plain digit dump, ...)
// into the .pi4 format the app loads: two digits per byte, ~500 MB per billion.
//
//   node scripts/pack-pi.mjs <digits.txt> [out.pi4]
//
// Digits must start with "3.14159..." (or "314159..."); everything that is not
// a digit is ignored. Put the result at public/pi-1b.pi4 and `npm run dev`
// loads it automatically, or pick it with "Load digits file" in the app.

import fs from 'node:fs';
import { DigitPacker } from '../src/data/piParse.js';

const [input, output = 'public/pi-1b.pi4'] = process.argv.slice(2);
if (!input) {
  console.error('usage: node scripts/pack-pi.mjs <digits.txt> [out.pi4]');
  process.exit(1);
}

const size = fs.statSync(input).size;
const packer = new DigitPacker(size); // a file never holds more digits than bytes
let read = 0;
for await (const chunk of fs.createReadStream(input, { highWaterMark: 16 * 1024 * 1024 })) {
  packer.push(chunk);
  read += chunk.length;
  process.stderr.write(`\r${((read / size) * 100).toFixed(1)}%`);
}
const packed = packer.finish();
fs.writeFileSync(output, packed);
console.error(`\n${packer.count.toLocaleString()} digits -> ${output} (${(packed.length / 1e6).toFixed(1)} MB)`);
