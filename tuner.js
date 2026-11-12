// tuner.js
document.addEventListener('DOMContentLoaded', () => {
    let audioContext = null;
    let analyser = null;
    let mediaStream = null;
    let animationId = null;
    let isTunerRunning = false;

    const noteNameEl = document.getElementById('noteName');
    const accidentalEl = document.getElementById('accidental');
    const octaveEl = document.getElementById('octave');
    const frequencyDisplay = document.getElementById('frequencyDisplay');
    const tuningIndicator = document.getElementById('tuningIndicator');
    const toggleTunerBtn = document.getElementById('toggleTuner');
    const ledBars = document.querySelectorAll('.led-bar');

    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    // Auto-correlation algorithm to detect fundamental pitch
    function autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        let sumOfSquares = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            sumOfSquares += val * val;
        }

        const rms = Math.sqrt(sumOfSquares / SIZE);
        if (rms < 0.012) {
            return -1; // Silence or background noise
        }

        let r1 = 0;
        let r2 = SIZE - 1;
        const thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) {
                r1 = i;
                break;
            }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) {
                r2 = SIZE - i;
                break;
            }
        }

        const trimmedBuffer = buffer.slice(r1, r2);
        const c = new Array(trimmedBuffer.length).fill(0);

        for (let i = 0; i < trimmedBuffer.length; i++) {
            for (let j = 0; j < trimmedBuffer.length - i; j++) {
                c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) {
            d++;
        }

        let maxval = -1;
        let maxpos = -1;
        for (let i = d; i < trimmedBuffer.length; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        let T0 = maxpos;

        // Parabolic interpolation for fine tuning accuracy
        if (T0 > 0 && T0 < trimmedBuffer.length - 1) {
            const x1 = c[T0 - 1];
            const x2 = c[T0];
            const x3 = c[T0 + 1];
            const a = (x1 + x3 - 2 * x2) / 2;
            const b = (x3 - x1) / 2;
            if (a) {
                T0 = T0 - b / (2 * a);
            }
        }

        return sampleRate / T0;
    }

    // Convert frequency to nearest note, accidental, octave and cents deviation
    function frequencyToNote(frequency) {
        const noteNumber = 12 * (Math.log2(frequency / 440)) + 69;
        const roundedNote = Math.round(noteNumber);
        const noteIndex = (roundedNote % 12 + 12) % 12;
        const octave = Math.floor(roundedNote / 12) - 1;
        const fullNote = noteNames[noteIndex];

        let baseNote = fullNote;
        let accidental = "";
        if (fullNote.includes("#")) {
            baseNote = fullNote[0];
            accidental = "#";
        }

        const targetFrequency = 440 * Math.pow(2, (roundedNote - 69) / 12);
        const cents = Math.round(1200 * Math.log2(frequency / targetFrequency));

        return { baseNote, accidental, octave, targetFrequency, cents };
    }

    // Update LED meter bars based on cents (-50 to +50)
    // 14 LED bars:
    // Indices 0..5: Flat (-50 to -6 cents)
    // Indices 6..7: Center In-Tune (-5 to +5 cents)
    // Indices 8..13: Sharp (+6 to +50 cents)
    function updateLedMeter(cents) {
        ledBars.forEach(bar => {
            bar.classList.remove('active', 'in-tune');
        });

        if (Math.abs(cents) <= 4) {
            // Exactly in tune: illuminate center LEDs with vibrant green
            ledBars[6].classList.add('active', 'in-tune');
            ledBars[7].classList.add('active', 'in-tune');
        } else if (cents < 0) {
            // Flat side: indices 0..5 (map -50 to -5)
            // Cents -5 is closest to center (index 5), -50 is farthest (index 0)
            const activeCount = Math.min(6, Math.max(1, Math.round(Math.abs(cents) / 50 * 6)));
            for (let i = 6 - activeCount; i <= 5; i++) {
                ledBars[i].classList.add('active');
            }
        } else {
            // Sharp side: indices 8..13 (map +5 to +50)
            // Cents +5 is closest to center (index 8), +50 is farthest (index 13)
            const activeCount = Math.min(6, Math.max(1, Math.round(cents / 50 * 6)));
            for (let i = 8; i < 8 + activeCount; i++) {
                ledBars[i].classList.add('active');
            }
        }
    }

    function clearMeter() {
        ledBars.forEach(bar => bar.classList.remove('active', 'in-tune'));
        if (noteNameEl) noteNameEl.textContent = '--';
        if (accidentalEl) accidentalEl.textContent = '';
        if (octaveEl) octaveEl.textContent = '';
        if (frequencyDisplay) frequencyDisplay.textContent = '-- Hz';
        if (tuningIndicator) {
            tuningIndicator.textContent = isTunerRunning ? 'LISTENING...' : 'STANDBY';
            tuningIndicator.className = 'lcd-badge';
        }
        if (noteNameEl) {
            noteNameEl.style.color = '#38bdf8';
            noteNameEl.style.textShadow = '0 0 25px rgba(56, 189, 248, 0.6)';
        }
    }

    async function startTuner() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (tuningIndicator) tuningIndicator.textContent = 'NO MIC SUPPORT';
            return;
        }

        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            const source = audioContext.createMediaStreamSource(mediaStream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            const buffer = new Float32Array(analyser.fftSize);
            isTunerRunning = true;
            if (toggleTunerBtn) {
                toggleTunerBtn.textContent = 'Turn Off';
                toggleTunerBtn.classList.add('active-running');
            }
            if (tuningIndicator) {
                tuningIndicator.textContent = 'LISTENING...';
                tuningIndicator.className = 'lcd-badge';
            }

            let silentFrames = 0;

            function detectPitch() {
                if (!isTunerRunning) return;

                analyser.getFloatTimeDomainData(buffer);
                const freq = autoCorrelate(buffer, audioContext.sampleRate);

                if (freq !== -1 && freq >= 60 && freq <= 1500) {
                    silentFrames = 0;
                    const { baseNote, accidental, octave, cents } = frequencyToNote(freq);

                    if (noteNameEl) noteNameEl.textContent = baseNote;
                    if (accidentalEl) accidentalEl.textContent = accidental;
                    if (octaveEl) octaveEl.textContent = octave;
                    if (frequencyDisplay) frequencyDisplay.textContent = `${freq.toFixed(1)} Hz`;

                    updateLedMeter(cents);

                    if (tuningIndicator) {
                        if (Math.abs(cents) <= 4) {
                            tuningIndicator.textContent = `IN TUNE (${cents > 0 ? '+' : ''}${cents}c)`;
                            tuningIndicator.className = 'lcd-badge in-tune';
                            noteNameEl.style.color = '#22c55e';
                            noteNameEl.style.textShadow = '0 0 30px rgba(34, 197, 94, 0.8)';
                            if (accidentalEl) accidentalEl.style.color = '#22c55e';
                        } else if (cents < 0) {
                            tuningIndicator.textContent = `FLAT (${cents}c)`;
                            tuningIndicator.className = 'lcd-badge flat';
                            noteNameEl.style.color = '#eab308';
                            noteNameEl.style.textShadow = '0 0 25px rgba(234, 179, 8, 0.6)';
                            if (accidentalEl) accidentalEl.style.color = '#eab308';
                        } else {
                            tuningIndicator.textContent = `SHARP (+${cents}c)`;
                            tuningIndicator.className = 'lcd-badge sharp';
                            noteNameEl.style.color = '#ef4444';
                            noteNameEl.style.textShadow = '0 0 25px rgba(239, 68, 68, 0.6)';
                            if (accidentalEl) accidentalEl.style.color = '#ef4444';
                        }
                    }
                } else {
                    silentFrames++;
                    // Fade to idle after brief silence
                    if (silentFrames > 25) {
                        ledBars.forEach(bar => bar.classList.remove('active', 'in-tune'));
                        if (tuningIndicator && isTunerRunning) {
                            tuningIndicator.textContent = 'LISTENING...';
                            tuningIndicator.className = 'lcd-badge';
                        }
                    }
                }

                animationId = requestAnimationFrame(detectPitch);
            }

            detectPitch();
        } catch (err) {
            console.error('Error starting tuner:', err);
            if (tuningIndicator) tuningIndicator.textContent = 'MIC BLOCKED';
            stopTuner();
        }
    }

    function stopTuner() {
        isTunerRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        if (toggleTunerBtn) {
            toggleTunerBtn.textContent = 'Power / Listen';
            toggleTunerBtn.classList.remove('active-running');
        }
        clearMeter();
    }

    if (toggleTunerBtn) {
        toggleTunerBtn.addEventListener('click', () => {
            if (isTunerRunning) {
                stopTuner();
            } else {
                startTuner();
            }
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isTunerRunning) {
            stopTuner();
        }
    });

    window.addEventListener('beforeunload', stopTuner);
});
