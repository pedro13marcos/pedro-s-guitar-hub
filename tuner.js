// tuner.js
document.addEventListener('DOMContentLoaded', () => {
    let audioContext = null;
    let analyser = null;
    let mediaStream = null;
    let animationId = null;
    let isTunerRunning = false;

    const noteDisplay = document.getElementById('noteDisplay');
    const frequencyDisplay = document.getElementById('frequencyDisplay');
    const tuningIndicator = document.getElementById('tuningIndicator');
    const toggleTunerBtn = document.getElementById('toggleTuner');

    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    // Auto-correlation algorithm to detect fundamental pitch / frequency
    function autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        let sumOfSquares = 0;
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            sumOfSquares += val * val;
        }

        // Root Mean Square (RMS) energy check for background silence/noise threshold
        const rms = Math.sqrt(sumOfSquares / SIZE);
        if (rms < 0.01) {
            return -1; // Too quiet
        }

        // Find range to search for pitch (Guitar/bass pitch range ~ 60Hz to 1000Hz)
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

        // Parabolic interpolation for sub-bin precision
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

    // Convert frequency to nearest note info across all octaves
    function frequencyToNote(frequency) {
        // A4 = 440 Hz is MIDI note 69
        const noteNumber = 12 * (Math.log2(frequency / 440)) + 69;
        const roundedNote = Math.round(noteNumber);
        const noteIndex = (roundedNote % 12 + 12) % 12;
        const octave = Math.floor(roundedNote / 12) - 1;
        const noteName = noteNames[noteIndex] + octave;

        // Exact target frequency for rounded note
        const targetFrequency = 440 * Math.pow(2, (roundedNote - 69) / 12);
        // Cents deviation from nearest note (-50 to +50 cents)
        const cents = Math.round(1200 * Math.log2(frequency / targetFrequency));

        return { noteName, targetFrequency, cents };
    }

    async function startTuner() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (tuningIndicator) tuningIndicator.textContent = 'Microphone access is not supported in this browser.';
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
            if (toggleTunerBtn) toggleTunerBtn.textContent = 'Stop Tuner';

            function detectPitch() {
                if (!isTunerRunning) return;

                analyser.getFloatTimeDomainData(buffer);
                const freq = autoCorrelate(buffer, audioContext.sampleRate);

                if (freq !== -1 && freq >= 60 && freq <= 1500) {
                    const { noteName, cents } = frequencyToNote(freq);
                    if (noteDisplay) noteDisplay.textContent = noteName;
                    if (frequencyDisplay) frequencyDisplay.textContent = `Frequency: ${freq.toFixed(1)} Hz`;

                    if (tuningIndicator) {
                        if (Math.abs(cents) <= 5) {
                            noteDisplay.style.color = '#22c55e'; // Green - in tune
                            tuningIndicator.style.color = '#22c55e';
                            tuningIndicator.textContent = `In Tune! (${cents > 0 ? '+' : ''}${cents} cents)`;
                        } else if (cents < 0) {
                            noteDisplay.style.color = '#f59e0b'; // Amber - flat
                            tuningIndicator.style.color = '#f59e0b';
                            tuningIndicator.textContent = `Flat (${cents} cents) - Tune up ↑`;
                        } else {
                            noteDisplay.style.color = '#f59e0b'; // Amber - sharp
                            tuningIndicator.style.color = '#f59e0b';
                            tuningIndicator.textContent = `Sharp (+${cents} cents) - Tune down ↓`;
                        }
                    }
                }

                animationId = requestAnimationFrame(detectPitch);
            }

            detectPitch();
        } catch (err) {
            console.error('Error starting tuner:', err);
            if (tuningIndicator) tuningIndicator.textContent = 'Microphone permission denied or unavailable.';
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
        if (toggleTunerBtn) toggleTunerBtn.textContent = 'Start Tuner';
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

    // Stop microphone if user leaves tab or page
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isTunerRunning) {
            stopTuner();
        }
    });

    window.addEventListener('beforeunload', stopTuner);
});
