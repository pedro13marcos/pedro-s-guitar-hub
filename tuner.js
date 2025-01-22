const startTunerButton = document.getElementById('startTuner');
const noteDisplay = document.getElementById('noteDisplay');
const frequencyDisplay = document.getElementById('frequencyDisplay');

let audioContext;
let analyser;
let microphone;
let scriptProcessor;

const noteFrequencies = [
    { note: 'E2', frequency: 82.41 },
    { note: 'A2', frequency: 110.00 },
    { note: 'D3', frequency: 146.83 },
    { note: 'G3', frequency: 196.00 },
    { note: 'B3', frequency: 246.94 },
    { note: 'E4', frequency: 329.63 },
];

function startTuner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support microphone access.');
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;

            microphone = audioContext.createMediaStreamSource(stream);
            scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

            microphone.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);

            scriptProcessor.onaudioprocess = processAudio;
        })
        .catch(err => {
            console.error('Microphone access denied:', err);
            alert('Could not access the microphone. Please allow microphone access.');
        });
}

function processAudio() {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const frequency = detectFrequency(buffer, audioContext.sampleRate);
    if (frequency) {
        const closestNote = findClosestNote(frequency);
        noteDisplay.textContent = `Note: ${closestNote.note}`;
        frequencyDisplay.textContent = `Frequency: ${frequency.toFixed(2)} Hz`;
    } else {
        noteDisplay.textContent = 'No sound detected';
        frequencyDisplay.textContent = 'Frequency: -- Hz';
    }
}

function detectFrequency(buffer, sampleRate) {
    const size = buffer.length;
    const autocorrelation = new Float32Array(size);
    let rms = 0;

    // Compute RMS to discard silent input
    for (let i = 0; i < size; i++) {
        const value = buffer[i];
        rms += value * value;
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return null; // Silent audio

    // Autocorrelation algorithm
    for (let lag = 0; lag < size; lag++) {
        let sum = 0;
        for (let i = 0; i < size - lag; i++) {
            sum += buffer[i] * buffer[i + lag];
        }
        autocorrelation[lag] = sum / size;
    }

    // Find the peak in autocorrelation
    let peakIndex = -1;
    let maxCorrelation = 0;
    for (let i = 1; i < size; i++) {
        if (autocorrelation[i] > maxCorrelation) {
            maxCorrelation = autocorrelation[i];
            peakIndex = i;
        }
    }

    if (peakIndex === -1 || maxCorrelation < 0.1) return null;

    // Convert lag to frequency
    return sampleRate / peakIndex;
}

function findClosestNote(frequency) {
    let closestNote = noteFrequencies[0];
    let smallestDifference = Math.abs(frequency - closestNote.frequency);

    for (const note of noteFrequencies) {
        const difference = Math.abs(frequency - note.frequency);
        if (difference < smallestDifference) {
            closestNote = note;
            smallestDifference = difference;
        }
    }

    return closestNote;
}


startTunerButton.addEventListener('click', startTuner);

console.log(buffer);