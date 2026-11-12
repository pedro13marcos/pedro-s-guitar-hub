let isMetronomeRunning = false;
let tempo = 120; // Default tempo (beats per minute)
let intervalId;
let audioContext;

const beatIndicator = document.getElementById("beatIndicator");

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

// Flash visual beat LED indicator dot
function flashBeat() {
    if (beatIndicator) {
        beatIndicator.classList.add("flash");
        setTimeout(() => {
            beatIndicator.classList.remove("flash");
        }, 75);
    }
}

// Create a simple click sound
function createClickSound() {
    const ctx = getAudioContext();
    const soundSource = ctx.createBufferSource();

    fetch('src/click.wav')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
        .then(decodedBuffer => {
            soundSource.buffer = decodedBuffer;
            soundSource.connect(ctx.destination);
            soundSource.start(0);
            flashBeat();
        })
        .catch(error => {
            console.error("Error loading sound:", error);
            flashBeat();
        });
}

function startMetronome() {
    if (!isMetronomeRunning) {
        isMetronomeRunning = true;
        createClickSound(); // Play immediate click on start
        intervalId = setInterval(() => {
            createClickSound();
        }, 60000 / tempo);
    }
}

function stopMetronome() {
    if (isMetronomeRunning) {
        clearInterval(intervalId);
        isMetronomeRunning = false;
        if (beatIndicator) {
            beatIndicator.classList.remove("flash");
        }
    }
}

function updateTempo(newTempo) {
    tempo = newTempo;
    if (isMetronomeRunning) {
        stopMetronome();
        startMetronome();
    }
}

// Get references to buttons & controls
const startMetronomeButton = document.getElementById("startMetronome");
const stopMetronomeButton = document.getElementById("stopMetronome");
const tempoInput = document.getElementById("tempo");
const tempoValue = document.getElementById("tempoValue");

if (startMetronomeButton) startMetronomeButton.addEventListener("click", startMetronome);
if (stopMetronomeButton) stopMetronomeButton.addEventListener("click", stopMetronome);

if (tempoInput) {
    tempoInput.addEventListener("input", () => {
        const newTempo = parseInt(tempoInput.value, 10);
        if (!isNaN(newTempo) && newTempo > 0) {
            updateTempo(newTempo);
            if (tempoValue) tempoValue.textContent = newTempo;
        } else {
            tempoInput.value = tempo;
            if (tempoValue) tempoValue.textContent = tempo;
        }
    });
}

// Initialize tempo display
if (tempoValue) tempoValue.textContent = tempo;
