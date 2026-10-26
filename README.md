# π Chroma — Digits of Pi Color Spectrum & Pattern Explorer

A fast, interactive web application exploring **1,000,001 digits of Pi** rendered as custom color spectrums, visual mosaics, Archimedean spirals, readable digit streams, and musical audio.

---

## ✨ Features

- **1,000,001 Certified Digits of Pi**: Pre-bundled with instantaneous startup and offline support.
- **Custom Color Assignment (0–9)**:
  - Interactive color pickers for each number 0 through 9.
  - Curated themes: *Spectral Rainbow*, *Cyberpunk Neon*, *Solar Sunset*, *Ocean Abyssal*, *Thermal Magma*, *Retro Terminal*, *Pastel Dream*, *Deep Forest*, *Monochrome*.
  - Harmonic shuffle / randomize and invert functions.
  - **Digit Solo / Filter Mode**: Dim all digits except one to spot patterns and distributions.
- **Multiple Visualization Modes**:
  - 🎨 **Color Mosaic (Canvas Matrix)**: Renders up to 1,000,000 pixels in 60fps HTML5 Canvas. Configurable grid widths (50, 100, 200, 314, 500, 1000 cols), pixel sizing (1px to 20px), shapes (Square, Rounded, Dots), zoom & pan, and hover tooltip displaying digit & index.
  - 🔢 **Digits Stream (Readable Numbers)**: Formatted with index line gutters (`#000050`), chunking (5 or 10 digits), and two display styles: *Color Badges* or *Color Text*.
  - 🌀 **Archimedean & Fermat Spirals**: Pi winding outwards from the center ($3.$) into an infinite circle mandala.
  - 📊 **Distribution & Randomness Analytics**: Frequency bar charts, percentage breakdown, $\chi^2$ (Chi-square) uniformity test, and a $10 \times 10$ transition heatmap.
- **Pattern Search & Discovery**:
  - Instant substring search across 1,000,001 digits.
  - Famous landmarks: **Feynman Point** (`999999` at position 762 with confetti celebration!), counting runs (`123456`), triple sevens (`777`), quad zeros (`0000`), Golden Ratio ($\phi$), and Euler's $e$.
  - **Birthday Finder**: Pick your birthday to find where it appears in Pi (MMDDYYYY, YYYYMMDD, DDMMYYYY, MMDD).
  - Match navigator with **Jump to Location** spotlight.
- **🎵 Audio Sonification (Web Audio API)**:
  - Listen to Pi as melody. Digits 0–9 map to pitches in Zen Pentatonic, Minor Mystery, Ambient Sine, or 8-Bit Arcade scales.
- **📷 High-Resolution Export**:
  - Export custom color Pi artwork as PNG with optional watermark and color palette legend.

---

## 🚀 Running the App

```bash
cd ~/Projects/pi-chroma
npm run dev
```

Open `http://localhost:5173/` in your browser.
