// playAlongEngine.js - Real-time Audio Pitch & Chord Recognition Engine for Play Along Mode
class PlayAlongEngine {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.mediaStream = null;
        this.isRunning = false;

        this.buffer = null;
        this.freqData = null;

        // Note names matching pitch classes (0 = C, 1 = C#, ..., 11 = B)
        this.noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    }

    async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Microphone not supported on this device/browser.");
        }

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);

        this.buffer = new Float32Array(this.analyser.fftSize);
        this.freqData = new Float32Array(this.analyser.frequencyBinCount);
        this.isRunning = true;
    }

    stop() {
        this.isRunning = false;
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }
        if (this.audioCtx && this.audioCtx.state !== 'closed') {
            this.audioCtx.close();
            this.audioCtx = null;
        }
    }

    // Monophonic Pitch Detection (Autocorrelation)
    detectPitch() {
        if (!this.isRunning || !this.analyser) return -1;
        this.analyser.getFloatTimeDomainData(this.buffer);

        const SIZE = this.buffer.length;
        let sumSquares = 0;
        for (let i = 0; i < SIZE; i++) {
            sumSquares += this.buffer[i] * this.buffer[i];
        }
        const rms = Math.sqrt(sumSquares / SIZE);
        if (rms < 0.012) return -1; // Silence threshold

        let r1 = 0, r2 = SIZE - 1;
        const thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(this.buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(this.buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        const trimmed = this.buffer.slice(r1, r2);
        const c = new Array(trimmed.length).fill(0);
        for (let i = 0; i < trimmed.length; i++) {
            for (let j = 0; j < trimmed.length - i; j++) {
                c[i] = c[i] + trimmed[j] * trimmed[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;

        let maxVal = -1, maxPos = -1;
        for (let i = d; i < trimmed.length; i++) {
            if (c[i] > maxVal) {
                maxVal = c[i];
                maxPos = i;
            }
        }

        let T0 = maxPos;
        if (T0 > 0 && T0 < trimmed.length - 1) {
            const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
            const a = (x1 + x3 - 2 * x2) / 2;
            const b = (x3 - x1) / 2;
            if (a) T0 = T0 - b / (2 * a);
        }

        return this.audioCtx.sampleRate / T0;
    }

    // Convert frequency to MIDI note number
    freqToMidi(freq) {
        if (freq <= 0) return -1;
        return Math.round(12 * Math.log2(freq / 440) + 69);
    }

    // Compute 12-dimensional Chromagram vector from FFT frequency spectrum
    computeChromagram() {
        if (!this.isRunning || !this.analyser) return new Array(12).fill(0);
        this.analyser.getFloatFrequencyData(this.freqData);

        const chroma = new Array(12).fill(0);
        const sampleRate = this.audioCtx.sampleRate;
        const binCount = this.analyser.frequencyBinCount;
        const binWidth = (sampleRate / 2) / binCount;

        // Guitar fundamental range: ~70 Hz to ~1200 Hz
        const minBin = Math.floor(70 / binWidth);
        const maxBin = Math.min(binCount - 1, Math.ceil(1200 / binWidth));

        for (let b = minBin; b <= maxBin; b++) {
            const db = this.freqData[b];
            if (db < -60) continue; // Noise gate

            // Linear energy scale from dB
            const linearEnergy = Math.pow(10, db / 20);
            const freq = b * binWidth;
            const midi = 12 * Math.log2(freq / 440) + 69;
            const pitchClass = (Math.round(midi) % 12 + 12) % 12;

            chroma[pitchClass] += linearEnergy;
        }

        // Normalize vector
        const maxChroma = Math.max(...chroma);
        if (maxChroma > 0) {
            for (let i = 0; i < 12; i++) {
                chroma[i] /= maxChroma;
            }
        }

        return chroma;
    }

    // Evaluate match against target notes (single note or chord)
    // targetMidiNotes: Array of numbers, e.g. [40] for Low E, or [60, 64, 67] for C Major
    evaluateMatch(targetMidiNotes) {
        if (!targetMidiNotes || targetMidiNotes.length === 0) return { matched: false, confidence: 0 };

        // 1. Single Note Detection via Autocorrelation
        if (targetMidiNotes.length === 1) {
            const freq = this.detectPitch();
            if (freq < 50 || freq > 1500) return { matched: false, confidence: 0 };

            const detectedMidi = this.freqToMidi(freq);
            const targetMidi = targetMidiNotes[0];
            // Match within +- 1 semitone (cents tolerance)
            const matched = Math.abs(detectedMidi - targetMidi) === 0;
            return {
                matched,
                confidence: matched ? 1.0 : 0.2,
                detectedPitch: this.noteNames[detectedMidi % 12],
                targetPitch: this.noteNames[targetMidi % 12]
            };
        }

        // 2. Polyphonic Chord Matching via Chromagram
        const chroma = this.computeChromagram();
        const targetPitchClasses = targetMidiNotes.map(m => (m % 12 + 12) % 12);
        const uniqueTargets = [...new Set(targetPitchClasses)];

        // Calculate average energy in expected chord bins
        let matchedEnergy = 0;
        uniqueTargets.forEach(pc => {
            matchedEnergy += chroma[pc];
        });
        const score = matchedEnergy / uniqueTargets.length;

        // If at least 55% average energy on chord component notes
        const matched = score >= 0.55;
        return {
            matched,
            confidence: score,
            targetPitch: uniqueTargets.map(pc => this.noteNames[pc]).join('/')
        };
    }
}

window.PlayAlongEngine = PlayAlongEngine;
