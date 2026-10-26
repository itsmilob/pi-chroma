// Web Audio API engine for sonifying Pi digits

class PiSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.timer = null;
    this.currentDigitIndex = 0;
    this.speed = 10; // digits per second (1 - 50)
    this.scaleType = 'pentatonic'; // 'pentatonic', 'minor', 'chiptune', 'ambient'
    this.onTick = null; // callback (index, digit)
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;

      // Add soft limiter / compressor
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
      compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getFrequency(digit) {
    const d = parseInt(digit, 10);
    if (isNaN(d)) return 440;

    // Harmonious musical scales mapped to 0-9
    switch (this.scaleType) {
      case 'minor': {
        // C Natural Minor / Blues
        const minorFreqs = [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25, 587.33, 622.25];
        return minorFreqs[d];
      }
      case 'chiptune': {
        // Bright retro arcade frequencies
        const chipFreqs = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        return chipFreqs[d];
      }
      case 'ambient': {
        // Pyramidal fifths and octaves
        const ambientFreqs = [174.61, 220.00, 261.63, 329.63, 349.23, 440.00, 523.25, 659.25, 698.46, 880.00];
        return ambientFreqs[d];
      }
      case 'pentatonic':
      default: {
        // C Pentatonic Major (Zen & harmonious)
        const penta = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
        return penta[d];
      }
    }
  }

  playDigitNote(digit, duration = 0.12) {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const freq = this.getFrequency(digit);
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    if (this.scaleType === 'chiptune') {
      osc.type = 'square';
    } else if (this.scaleType === 'ambient') {
      osc.type = 'sine';
    } else {
      osc.type = 'triangle';
    }

    osc.frequency.setValueAtTime(freq, now);

    // ADSR Envelope
    const attack = 0.01;
    const decay = duration * 0.9;
    noteGain.gain.setValueAtTime(0.001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.35, now + attack);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  }

  start(piDigits, startIndex = 0, onTick = null) {
    this.init();
    this.isPlaying = true;
    this.currentDigitIndex = startIndex;
    this.onTick = onTick;

    const step = () => {
      if (!this.isPlaying) return;
      if (this.currentDigitIndex >= piDigits.length) {
        this.stop();
        return;
      }

      const digit = piDigits[this.currentDigitIndex];
      const duration = Math.max(0.04, 1 / this.speed);
      this.playDigitNote(digit, duration);

      if (this.onTick) {
        this.onTick(this.currentDigitIndex, digit);
      }

      this.currentDigitIndex++;
      this.timer = setTimeout(step, 1000 / this.speed);
    };

    step();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setSpeed(speed) {
    this.speed = Math.max(1, Math.min(60, speed));
  }

  setVolume(vol) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  setScale(scaleType) {
    this.scaleType = scaleType;
  }
}

export const piSynth = new PiSynth();
