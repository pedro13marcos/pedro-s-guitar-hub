let isMetronomeRunning = false;
let tempo = 120; // Default tempo (beats per minute)
let intervalId;
const audioContext = new AudioContext();



// Create a simple click sound (you can use other sounds if you prefer)
function createClickSound() {
    const soundSource = audioContext.createBufferSource();

    fetch('/src/click.wav') // Path to your sound file
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(decodedBuffer => {
            soundSource.buffer = decodedBuffer;
            soundSource.connect(audioContext.destination); // Connect to output
            soundSource.start(0);

        })
        .catch(error => console.error("Error loading sound:", error));

}

function startMetronome() {
    if (!isMetronomeRunning) {
        isMetronomeRunning = true;
        intervalId = setInterval(() => {
            createClickSound();
        }, 60000 / tempo); // Interval in milliseconds (60000 / tempo)
    }
}


function stopMetronome() {
    if (isMetronomeRunning) {
        clearInterval(intervalId);
        isMetronomeRunning = false;
    }
}

function updateTempo(newTempo) {
    tempo = newTempo;
    if (isMetronomeRunning) {
        stopMetronome(); // Restart timer to reflect tempo changes
        startMetronome();
    }
}


// Get references to buttons (add these to your HTML)
const startmetronomeButton = document.getElementById("startMetronome");
const stopMetronomeButton = document.getElementById("stopMetronome");
const tempoInput = document.getElementById("tempo");
// Tempo display
const tempoValue = document.getElementById("tempoValue");


startmetronomeButton.addEventListener("click", startMetronome);
stopMetronomeButton.addEventListener("click", stopMetronome);


tempoInput.addEventListener("input", () => {
    const newTempo = parseInt(tempoInput.value, 10);  //Get number from input
    if (!isNaN(newTempo) && newTempo > 0) {     //Check if is number
        updateTempo(newTempo);
        tempoValue.textContent = newTempo;
    } else {
        tempoInput.value = tempo; // Revert to the current tempo if the input is invalid
        tempoValue.textContent = tempo;
    }

});



// Initialize tempo display
tempoValue.textContent = tempo;